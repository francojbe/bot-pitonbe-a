export const formatRut = (rut) => {
    if (!rut) return ''
    // Eliminar puntos y guiones
    let value = rut.replace(/\./g, '').replace(/-/g, '')

    if (value.length < 2) return value

    // Separar cuerpo y dígito verificador
    const body = value.slice(0, -1)
    const dv = value.slice(-1).toUpperCase()

    // Formatear cuerpo con puntos
    const formattedBody = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')

    return `${formattedBody}-${dv}`
}

export const validateRut = (rut) => {
    if (!rut) return false

    const cleanRut = rut.replace(/\./g, '').replace(/-/g, '')
    if (cleanRut.length < 2) return false

    const body = cleanRut.slice(0, -1)
    const dv = cleanRut.slice(-1).toUpperCase()

    if (!/^\d+$/.test(body)) return false

    let sum = 0
    let multiplier = 2

    for (let i = body.length - 1; i >= 0; i--) {
        sum += parseInt(body[i]) * multiplier
        multiplier = multiplier === 7 ? 2 : multiplier + 1
    }

    const expectedDv = 11 - (sum % 11)

    let expectedDvStr = expectedDv === 11 ? '0' : expectedDv === 10 ? 'K' : expectedDv.toString()

    return dv === expectedDvStr
}

export const formatPhone = (phone) => {
    if (!phone) return ''
    // Dejar solo números y el símbolo +
    return phone.replace(/[^0-9+]/g, '')
}

export const validatePhone = (phone) => {
    // Acepta formatos como +56912345678 o 912345678
    const cleanPhone = phone.replace(/[^0-9]/g, '')
    return cleanPhone.length >= 8 && cleanPhone.length <= 15
}
