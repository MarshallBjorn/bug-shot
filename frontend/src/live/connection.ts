import { HubConnectionBuilder, LogLevel } from '@microsoft/signalr'
import { accessToken, renewSession } from '../auth/session'
import { apiBaseUrl } from '../config'

export const hubPath = '/api/v1/hubs/tickets'

export function createTicketConnection() {
  return (
    new HubConnectionBuilder()
      .withUrl(`${apiBaseUrl}${hubPath}`, {
        // WebSocket nie ustawia nagłówków więc klient dokleja token do adresu
        // po odświeżeniu strony sesja może jeszcze nie wrócić więc czekamy na nią tutaj
        accessTokenFactory: async () => accessToken() ?? (await renewSession())?.accessToken ?? '',
      })
      // domyślne opóźnienia to 0, 2, 10 i 30 sekund, potem połączenie zostaje zamknięte
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build()
  )
}
