import { apiRequest } from './api/client'

// plik chroniony tokenem nie wejdzie do <img src> bo przeglądarka nie doklei tam nagłówka
// więc pobieramy go żądaniem z tokenem i pokazujemy jako blob
export async function fetchAttachment(attachmentId: string, signal?: AbortSignal) {
  const response = await apiRequest(`/api/v1/attachments/${attachmentId}/download`, signal)

  return URL.createObjectURL(await response.blob())
}

export async function downloadAttachment(attachmentId: string, fileName: string) {
  const url = await fetchAttachment(attachmentId)

  const link = document.createElement('a')
  link.download = fileName
  link.href = url
  link.click()

  // adres zwalniamy dopiero po oddaniu sterowania przeglądarce bo natychmiastowe
  // zwolnienie potrafi przerwać rozpoczęte pobieranie
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

export function isImage(contentType: string) {
  return contentType.startsWith('image/')
}
