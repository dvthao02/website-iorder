export class InvalidAdministratorCredentialsError extends Error {
  constructor() {
    super("Thông tin đăng nhập quản trị không chính xác.");
    this.name = "InvalidAdministratorCredentialsError";
  }
}
