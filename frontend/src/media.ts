import { mediaBaseUrl } from './config'

// backend trzyma w bazie ścieżkę względną a plik wystawia nginx spod osobnego adresu
export function attachmentUrl(uri: string) {
  return `${mediaBaseUrl}${uri}`
}

export function isImage(contentType: string) {
  return contentType.startsWith('image/')
}
