"""
Pipeline de 2 agentes (Google ADK) para o StakeholderVirtual:

1. `stakeholder_persona`  — responde como o stakeholder, no tom natural e
   "evasivo" de uma entrevista real, mas restrito ao relatório fornecido.
2. `fidelity_verifier`    — recebe a resposta rascunho do primeiro agente e
   decide se ela é sustentada pelo relatório. Se não for, força uma
   resposta de "não sei" em vez de deixar a invenção passar.

O serviço é *stateless* por design: cada chamada recebe o relatório e o
histórico inteiros vindos do backend Node (que é quem persiste tudo no
Postgres) e cria uma sessão do ADK só para essa execução, descartada logo
depois. Isso evita depender de estado em memória do processo Python, que
se perderia a cada redeploy/restart no Render.
"""

import os
import uuid
from typing import Any, Dict, List

from pydantic import BaseModel
from google.adk.agents.llm_agent import LlmAgent
from google.adk.agents.sequential_agent import SequentialAgent
from google.adk.models.lite_llm import LiteLlm
from google.adk.runners import InMemoryRunner
from google.genai import types

APP_NAME = "stakeholder-virtual"
MODEL_NAME = os.getenv("ADK_MODEL", "openai/gpt-4o-mini")  # LiteLLM -> usa OPENAI_API_KEY

PERSONA_INSTRUCTION = """
Você é um stakeholder virtual que representa um cliente real em uma entrevista de
levantamento de requisitos de Engenharia de Software. Você participou das reuniões
sobre o sistema descrito no relatório abaixo e tem informações gerais sobre ele,
mas não fala como um documento técnico.

Regras de estilo:
- Responda de forma natural, curta e conversacional, como em uma entrevista real.
- Não liste funcionalidades de forma organizada ou numerada.
- Evite linguagem técnica ou estruturada de documento de requisitos.
- Não revele todos os detalhes de uma vez — deixe o estudante investigar aos poucos.
- Se o estudante sugerir algo plausível e coerente com o relatório, aceite ou
  complemente de forma natural.

Regra inegociável: use SOMENTE as informações do RELATÓRIO e do HISTÓRICO abaixo.
Se a pergunta pedir algo que não está no relatório, diga com naturalidade que não
tem certeza / que isso não foi discutido nas reuniões — nunca invente um detalhe
que não esteja no relatório.

RELATÓRIO DE APOIO (use como pano de fundo, não cite como lista):
{report_text}

HISTÓRICO DA CONVERSA ATÉ AGORA:
{history}

PERGUNTA ATUAL DO ESTUDANTE:
{question}

Responda apenas com a fala do stakeholder, sem nenhum comentário fora do personagem.
""".strip()

VERIFIER_INSTRUCTION = """
Você é um verificador de fidelidade factual. Sua única tarefa é comparar a
RESPOSTA RASCUNHO com o RELATÓRIO e decidir se as afirmações feitas nela são
sustentadas pelo relatório (ou são inferências razoáveis e conservadoras a partir
dele) ou se contêm invenção/alucinação.

RELATÓRIO:
{report_text}

PERGUNTA DO ESTUDANTE:
{question}

RESPOSTA RASCUNHO DO STAKEHOLDER:
{draft_answer}

Se a resposta rascunho for fiel ao relatório: devolva grounded=true e repita a
resposta rascunho (ou uma versão levemente polida, sem mudar o conteúdo) em
final_answer.

Se a resposta rascunho inventar algo que não está no relatório: devolva
grounded=false e, em final_answer, escreva uma resposta curta e natural do
stakeholder dizendo que não tem certeza sobre esse ponto específico / que isso
não foi definido nas reuniões — mantendo o tom de personagem, não de sistema.
""".strip()


class VerificationResult(BaseModel):
    grounded: bool
    final_answer: str


def _build_pipeline() -> SequentialAgent:
    persona_agent = LlmAgent(
        name="stakeholder_persona",
        model=LiteLlm(model=MODEL_NAME),
        instruction=PERSONA_INSTRUCTION,
        output_key="draft_answer",
    )
    verifier_agent = LlmAgent(
        name="fidelity_verifier",
        model=LiteLlm(model=MODEL_NAME),
        instruction=VERIFIER_INSTRUCTION,
        output_schema=VerificationResult,
        output_key="verification",
    )
    return SequentialAgent(name="stakeholder_pipeline", sub_agents=[persona_agent, verifier_agent])


def _format_history(history: List[Dict[str, str]]) -> str:
    if not history:
        return "(sem histórico ainda, é a primeira pergunta desta conversa)"
    linhas = []
    for turn in history:
        quem = "Aluno" if turn["role"] == "user" else "Stakeholder"
        linhas.append(f"{quem}: {turn['content']}")
    return "\n".join(linhas)


async def run_pipeline(question: str, report_text: str, history: List[Dict[str, str]]) -> Dict[str, Any]:
    pipeline = _build_pipeline()
    runner = InMemoryRunner(agent=pipeline, app_name=APP_NAME)

    user_id = "adhoc-user"
    session_id = str(uuid.uuid4())

    await runner.session_service.create_session(
        app_name=APP_NAME,
        user_id=user_id,
        session_id=session_id,
        state={
            "report_text": report_text,
            "history": _format_history(history),
            "question": question,
        },
    )

    new_message = types.Content(role="user", parts=[types.Part(text=question)])

    async for _event in runner.run_async(
        user_id=user_id, session_id=session_id, new_message=new_message
    ):
        pass  # só precisamos do estado final, não dos eventos intermediários

    session = await runner.session_service.get_session(
        app_name=APP_NAME, user_id=user_id, session_id=session_id
    )

    verification = session.state.get("verification")
    draft_answer = session.state.get("draft_answer", "")

    if isinstance(verification, VerificationResult):
        grounded = verification.grounded
        final_answer = verification.final_answer
    elif isinstance(verification, dict):
        grounded = bool(verification.get("grounded", False))
        final_answer = verification.get("final_answer") or draft_answer
    else:
        # Defensivo: se o verificador não produziu um resultado utilizável,
        # não arriscamos alucinação — tratamos como não fundamentado.
        grounded = False
        final_answer = (
            "Isso eu não sei te dizer com certeza, não é algo que ficou "
            "claro nas reuniões que participei."
        )

    return {"answer": final_answer, "grounded": grounded}
