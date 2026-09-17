import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OverviewLogs from './OverviewLogs'
import OverviewProject from './OverviewProject'
import OverviewScreenshot from './OverviewScreenshot'
import OverviewTimestamp from './OverviewTimestamp'
import OverviewUrl from './OverviewUrl'
import OverviewUserAgent from './OverviewUserAgent'
import { useAttachment } from '../../hooks/useAttachment'
import type { TicketAttachment, TicketClientEnvironment } from '../../types'

vi.mock('../../hooks/useAttachment', () => ({
  useAttachment: vi.fn(),
}))

const environment: TicketClientEnvironment = {
  browserName: 'Chrome',
  osName: 'Windows',
  deviceType: 'desktop',
  viewportWidth: 1536,
  viewportHeight: 730,
  devicePixelRatio: 1.25,
  language: 'pl-PL',
  timeZone: 'Europe/Warsaw',
}

const screenshot: TicketAttachment = {
  id: 'a1',
  kind: 'Screenshot',
  fileName: 'zrzut.png',
  contentType: 'image/png',
  sizeBytes: 1024,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useAttachment).mockReturnValue({ url: 'blob:x', failed: false })
})

afterEach(() => {
  cleanup()
})

describe('blok adresu strony', () => {
  it('klik filtruje liste po znormalizowanym adresie', () => {
    const onFilterByPage = vi.fn()

    render(
      <OverviewUrl
        pageUrl="https://acme.example/cart?utm=x"
        page="acme.example/cart"
        onFilterByPage={onFilterByPage}
      />,
    )

    fireEvent.click(screen.getByRole('button'))

    expect(onFilterByPage).toHaveBeenCalledWith('acme.example/cart')
  })

  // tombstone traci adres wiec nie ma dokad prowadzic
  it('bez adresu nie jest klikalny', () => {
    render(<OverviewUrl pageUrl="" page="" onFilterByPage={vi.fn()} />)

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Adres został skasowany')).toBeDefined()
  })
})

describe('blok przegladarki', () => {
  it('klik filtruje liste po rozpoznanej przegladarce', () => {
    const onFilterByBrowser = vi.fn()

    render(
      <OverviewUserAgent
        userAgent="Mozilla/5.0"
        environment={environment}
        onFilterByBrowser={onFilterByBrowser}
      />,
    )

    fireEvent.click(screen.getByRole('button'))

    expect(onFilterByBrowser).toHaveBeenCalledWith('Chrome')
  })

  it('streszcza przegladarke system i urzadzenie', () => {
    render(
      <OverviewUserAgent
        userAgent="Mozilla/5.0"
        environment={environment}
        onFilterByBrowser={vi.fn()}
      />,
    )

    expect(screen.getByText('Chrome, Windows, Komputer')).toBeDefined()
  })

  it('nierozpoznana przegladarka nie jest klikalna', () => {
    render(
      <OverviewUserAgent
        userAgent=""
        environment={{ ...environment, browserName: '', osName: '', deviceType: '' }}
        onFilterByBrowser={vi.fn()}
      />,
    )

    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText('Nierozpoznana')).toBeDefined()
  })
})

describe('blok czasu', () => {
  it('zgodne zegary pokazuja jeden czas', () => {
    render(
      <OverviewTimestamp
        reportedAt="2026-09-17T10:00:00Z"
        receivedAt="2026-09-17T10:00:30Z"
      />,
    )

    expect(screen.queryByText(/Zegar przeglądarki/)).toBeNull()
  })

  // reportedAt podaje zegar klienta wiec duzy rozjazd trzeba pokazac
  it('rozjazd zegarow jest zaznaczony', () => {
    render(
      <OverviewTimestamp
        reportedAt="2026-09-17T08:00:00Z"
        receivedAt="2026-09-17T10:00:00Z"
      />,
    )

    expect(screen.getByText(/Zegar przeglądarki rozjechał się z serwerem/)).toBeDefined()
  })

  it('brak czasu z klienta schodzi na czas przyjecia', () => {
    render(<OverviewTimestamp reportedAt={null} receivedAt="2026-09-17T10:00:00Z" />)

    expect(screen.queryByText(/Zegar przeglądarki/)).toBeNull()
  })
})

describe('blok projektu', () => {
  it('klik prowadzi do listy projektu', () => {
    const onOpenProject = vi.fn()

    render(<OverviewProject projectKey="demo" onOpenProject={onOpenProject} />)

    fireEvent.click(screen.getByRole('button'))

    expect(onOpenProject).toHaveBeenCalledTimes(1)
  })
})

describe('blok zrzutu', () => {
  it('klik otwiera podglad', () => {
    const onOpen = vi.fn()

    render(<OverviewScreenshot screenshot={screenshot} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Otwórz zrzut ekranu w podglądzie' }))

    expect(onOpen).toHaveBeenCalledTimes(1)
  })

  it('bez zrzutu mowi o tym i nie da sie kliknac', () => {
    render(<OverviewScreenshot screenshot={null} onOpen={vi.fn()} />)

    expect(screen.getByText('Zgłoszenie nie ma zrzutu ekranu.')).toBeDefined()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('nieudane pobranie mowi o tym zamiast pustego kadru', () => {
    vi.mocked(useAttachment).mockReturnValue({ url: null, failed: true })

    render(<OverviewScreenshot screenshot={screenshot} onOpen={vi.fn()} />)

    expect(screen.getByText('Nie udało się pobrać zrzutu')).toBeDefined()
  })
})

describe('blok logu konsoli', () => {
  const log = [
    '[2026-09-17T10:00:00.000Z] ERROR console.error: TypeError x',
    '[2026-09-17T10:00:05.000Z] WARN console.warn: ostrzezenie',
    '[2026-09-17T10:00:10.000Z] INFO console.log: widok gotowy',
  ].join('\n')

  it('klik w tresc otwiera pelny log bez filtra', () => {
    const onOpen = vi.fn()

    render(<OverviewLogs text={log} loading={false} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Otwórz pełny log konsoli' }))

    expect(onOpen).toHaveBeenCalledWith(null)
  })

  it('klik w licznik poziomu otwiera log przefiltrowany', () => {
    const onOpen = vi.fn()

    render(<OverviewLogs text={log} loading={false} onOpen={onOpen} />)

    fireEvent.click(screen.getByRole('button', { name: 'Pokaż wpisy ERROR w logu konsoli' }))

    expect(onOpen).toHaveBeenCalledWith('ERROR')
  })

  it('poziomy bez wpisow nie dostaja licznika', () => {
    render(<OverviewLogs text={log} loading={false} onOpen={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /DEBUG/ })).toBeNull()
  })

  it('podglad wyciaga bledy przed inne wpisy', () => {
    const withLateError = [
      '[2026-09-17T10:00:00.000Z] INFO console.log: pierwszy',
      '[2026-09-17T10:00:05.000Z] WARN console.warn: drugi',
      '[2026-09-17T10:00:10.000Z] ERROR console.error: TypeError x',
    ].join('\n')

    render(<OverviewLogs text={withLateError} loading={false} onOpen={vi.fn()} />)

    const preview = screen.getByRole('button', { name: 'Otwórz pełny log konsoli' })

    expect(preview.textContent?.indexOf('TypeError x')).toBeLessThan(
      preview.textContent?.indexOf('pierwszy') ?? -1,
    )
  })

  // kadr ma trzy linie wiec dluzszy log musi powiedziec ile zostalo
  it('dluzszy log mowi ile wpisow zostalo poza podgladem', () => {
    const many = Array.from(
      { length: 6 },
      (_, index) => `[2026-09-17T10:00:0${index}.000Z] INFO console.log: wpis ${index}`,
    ).join('\n')

    render(<OverviewLogs text={many} loading={false} onOpen={vi.fn()} />)

    expect(screen.getByText('i 3 dalszych wpisów')).toBeDefined()
  })

  it('bez logu mowi o tym wprost', () => {
    render(<OverviewLogs text={null} loading={false} onOpen={vi.fn()} />)

    expect(screen.getByText('Zgłoszenie nie ma logu konsoli.')).toBeDefined()
  })

  it('w trakcie pobierania pokazuje postep', () => {
    render(<OverviewLogs text={null} loading onOpen={vi.fn()} />)

    expect(screen.getByText('Pobieranie logu konsoli...')).toBeDefined()
  })

  // plik moze byc, a i tak nie miec ani jednego wpisu w formacie widgetu
  it('log nie do sparsowania mowi o tym zamiast pustego kadru', () => {
    render(<OverviewLogs text="cokolwiek bez naglowka" loading={false} onOpen={vi.fn()} />)

    expect(screen.getByText(/Log konsoli ma nieznany format/)).toBeDefined()
  })
})
