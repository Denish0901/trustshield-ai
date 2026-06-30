import fitz


def extract_text_from_pdf(file_path: str) -> str:
    text = ""

    try:
        pdf_document = fitz.open(file_path)

        for page in pdf_document:
            page_text = page.get_text()
            text += page_text + "\n"

        pdf_document.close()

        return text.strip()

    except Exception as error:
        return f"PDF extraction failed: {str(error)}"