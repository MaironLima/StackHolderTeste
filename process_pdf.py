import PyPDF2

def extrair_texto_pdf(caminho_pdf):
    texto = ""
    with open(caminho_pdf, 'rb') as pdf_file:
        leitor = PyPDF2.PdfReader(pdf_file)
        for pagina in leitor.pages:
            texto += pagina.extract_text()
    return texto

if __name__ == "__main__":
    caminho = "requisitos.pdf"
    texto = extrair_texto_pdf(caminho)
    print(texto[:500])  # Exibe os primeiros 500 caracteres
    
