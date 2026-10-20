function text(value: unknown): string | null {
  const scalar = Array.isArray(value) && value.length === 1 ? value[0] : value;
  return typeof scalar === "string" && scalar.trim() ? scalar.trim() : null;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function attribute(attributes: Record<string, unknown>, ...names: string[]): string | null {
  for (const name of names) {
    const value = text(attributes[name]);
    if (value) return value;
  }
  return null;
}

export function getAccountProfile(session: Record<string, unknown>) {
  const isSaml = session.protocol === "saml";
  const attributes = isSaml ? record(session.attributes) : {};
  const nameId = isSaml ? text(session.nameId) : null;
  const subject = text(session.sub) ?? nameId;
  const email = text(session.email)
    ?? attribute(attributes, "email", "emailAddress", "mail", "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress")
    // A SAML NameID isn't necessarily an email address.
    ?? (nameId && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nameId) ? nameId : null);
  const firstName = text(session.given_name) ?? attribute(attributes, "firstName", "given_name", "givenName");
  const lastName = text(session.family_name) ?? attribute(attributes, "lastName", "family_name", "surname");
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    account: isSaml ? nameId ?? subject ?? email : text(session.preferred_username) ?? email ?? subject,
    sub: subject,
    email,
    name: text(session.name) ?? attribute(attributes, "name", "displayName") ?? (fullName || null),
    employee_code: text(session.employee_code) ?? attribute(attributes, "employee_code"),
    department: text(session.department) ?? attribute(attributes, "department"),
  };
}
