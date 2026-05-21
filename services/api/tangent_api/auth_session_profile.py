def get_auth_session_initials(display_name: str, email: str) -> str:
    source = display_name or email
    initials = "".join(part[:1].upper() for part in source.replace("_", " ").replace(".", " ").split()[:2] if part)
    return initials or "T"
