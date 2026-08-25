import type { PagedResult, TicketListItem } from '../types'

export const mockTickets: PagedResult<TicketListItem> = {
  items: [
    {
      id: '3f7c1c2e-0f4a-4a1d-9a4b-2b5f0d1c8a11',
      description: 'Koszyk gubi produkty po odświeżeniu strony',
      pageUrl: 'https://acme.example/cart',
      status: 'New',
      reportedAt: '2026-08-25T09:12:33+00:00',
      receivedAt: '2026-08-25T09:12:34+00:00',
      updatedAt: '2026-08-25T09:12:34+00:00',
    },
    {
      id: '9c2b7a44-5d61-4f0e-8a77-1c9d3e6b4f22',
      description: 'Przycisk płatności nie reaguje na Safari',
      pageUrl: 'https://acme.example/checkout',
      status: 'InProgress',
      reportedAt: '2026-08-24T18:40:02+00:00',
      receivedAt: '2026-08-24T18:40:05+00:00',
      updatedAt: '2026-08-25T07:15:00+00:00',
    },
    {
      id: 'b18d5f90-6e33-4c2a-9f51-70a2c4d8e933',
      description: 'Logo rozjeżdża się na szerokości 320px',
      pageUrl: 'https://acme.example/',
      status: 'Resolved',
      reportedAt: null,
      receivedAt: '2026-08-23T11:05:44+00:00',
      updatedAt: '2026-08-24T09:30:12+00:00',
    },
    {
      id: 'd4a0e7c1-2f88-4b6d-83b0-5e6f1a9c2d44',
      description: 'Literówka w regulaminie, punkt 4',
      pageUrl: 'https://acme.example/regulamin',
      status: 'Rejected',
      reportedAt: '2026-08-22T14:22:10+00:00',
      receivedAt: '2026-08-22T14:22:11+00:00',
      updatedAt: '2026-08-22T16:01:37+00:00',
    },
  ],
  total: 4,
  page: 1,
  pageSize: 20,
}
