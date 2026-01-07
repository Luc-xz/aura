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
    const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
    return regex.test(val)
  }
}

export default Validator