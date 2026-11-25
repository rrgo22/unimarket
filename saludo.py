def saludar(nombre_completo):
    """Devuelve un saludo personalizado validando que el nombre no sea vacío."""
    if nombre_completo is None or nombre_completo.strip() == "":
        return "Error: el nombre no puede estar vacío"
    return f"Hola {nombre_completo}"


print(saludar("GitHub"))
print(saludar(""))
