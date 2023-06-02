import pdfplumber

path = "./txts/商票截至2023年4月30日持续逾期名单.pdf"


with pdfplumber.open(path) as pdf:
    names = []

    for page in pdf.pages:
        table = page.extract_table()
        if table is None:
            continue

        names.extend([f"{row[1]}\n" for row in table])

    with open("./rev.txt", mode="w") as f:
        f.writelines(names)
