export const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

// załączniki serwuje nginx a nie API więc adres jest osobny
export const mediaBaseUrl = import.meta.env.VITE_MEDIA_BASE_URL ?? 'http://localhost:8081'

// zanim będzie logowanie dashboard nie ma skąd wziąć listy projektów
export const defaultProjectId = import.meta.env.VITE_PROJECT_ID ?? ''
