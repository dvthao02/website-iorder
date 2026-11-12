type UserAuditInput = {
  id: string; username: string; email: string | null; fullName: string; status: string;
};

// Chỉ chọn trường an toàn; không spread dòng DB chứa passwordHash vào audit log.
export function userAuditSnapshot(user: UserAuditInput | undefined) {
  if (!user) return null;
  return { id: user.id, username: user.username, email: user.email, fullName: user.fullName, status: user.status };
}
