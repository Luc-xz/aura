class Validator {
  static isValidName(val) {
    const regex = /^[a-zA-Z0-9_-]{4,16}$/
    return regex.test(val)
  }

  static isEmail(val) {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return regex.test(val)
  }

  static isStrongPassword(val) {
    // 强密码校验：至少8个字符，包含字母、数字和特殊字符 (-_)
    const regex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[-_])[A-Za-z\d-_]{8,}$/
    return regex.test(val)
  }
}

export default Validator