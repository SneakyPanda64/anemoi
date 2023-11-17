import { BrowserView, BrowserWindow, screen, session } from 'electron'
import path from 'path'
import { getFavicon, getViewById } from './util'
import { encode } from 'js-base64'
import { deleteWindow, getWindowData } from './window'
import { getHeader } from './header'
import { getOverlay, isOverlay } from './overlay'
import { addHistory } from './db'
import { v4 as uuidv4 } from 'uuid'
import { getFaviconData } from './favicon'
import { router } from './url'
import { createContextMenu } from './contexts'
const NAVIGATOR_HEIGHT = 80

export async function selectTab(tabId: number) {
  const view = getViewById(tabId)
  if (view == null) return
  const win = BrowserWindow.fromBrowserView(view)
  if (win == null) return
  const tabs = await getTabs(win.id)

  for (const element of tabs) {
    if (element.id !== tabId) {
      hideTab(element.id)
    } else {
      showTab(tabId)
    }
  }
  const header = await getHeader(win)
  if (header == null) return
  header.webContents.send('selected-tab-updated', tabId)
}

export async function deleteTab(tabId: number) {
  const view = getViewById(tabId)
  if (view == null) return
  const win = BrowserWindow.fromBrowserView(view)
  if (win == null) return
  await removeTabListeners(view)
  win.removeBrowserView(view)
  ;(view.webContents as any).destroy()

  const header = await getHeader(win)
  if (header != null) {
    const tabs = await getTabs(win.id)
    header.webContents.send('tabs-updated', tabs)
  }
}

export async function removeTabListeners(view: BrowserView) {
  view.webContents.removeAllListeners()
}

export async function applyTabListeners(view: BrowserView) {
  const win = BrowserWindow.fromBrowserView(view)
  if (win === null) return
  const header = await getHeader(win)
  if (header != null) {
    view.webContents.setMaxListeners(0)
    view.webContents.on('page-title-updated', async () => {
      const tabs = await getTabs(win!.id)
      header.webContents.send('tabs-updated', tabs)
    })
    view.webContents.on('did-start-loading', async () => {
      const tabs = await getTabs(win!.id)
      console.log('did-start-loading', tabs[0].title)
      header.webContents.send('tabs-updated', tabs)
    })
    view.webContents.once('did-finish-load', async () => {
      const tabs = await getTabs(win!.id)
      header.webContents.send('tabs-updated', tabs)
    })
    view.webContents.once('did-stop-loading', async () => {
      const tabs = await getTabs(win!.id)
      header.webContents.send('tabs-updated', tabs)
    })

    view.webContents.on('context-menu', async (_) => {
      createContextMenu(view, 'body')
    })
    const prevUrls: string[] = []
    view.webContents.on('did-fail-load', async (_, errorCode) => {
      console.log('FAILED', errorCode)
      const tabs = await getTabs(win!.id)
      header.webContents.send('tabs-updated', tabs)
    })
    view.webContents.on('did-navigate', async (_, url) => {
      if (!prevUrls.includes(url)) {
        console.log('new NAVIGATED!')
        if (!getWindowData(win!).private) {
          const favicon_url = await getFavicon(view)
          addHistory({
            id: `${uuidv4()}`,
            favicon: favicon_url ?? 'navigated',
            title: view.webContents.getTitle(),
            url: url,
            timestamp: Date.now()
          })
          prevUrls.push(url)
        }
      }
    })
    view.webContents.on('page-favicon-updated', async (_, favicons) => {
      const tabs = await getTabs(win!.id, favicons[0])
      header.webContents.send('tabs-updated', tabs)
    })
  }
}

export async function createTab(windowId: number, url = '') {
  const win = BrowserWindow.fromId(windowId)
  if (win === null) return
  const isPrivate = getWindowData(win).private
  const privateSession = session.fromPartition('empty-session')
  privateSession.clearStorageData()
  const view = new BrowserView({
    webPreferences: {
      devTools: true,
      preload: path.join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true,
      session: isPrivate ? privateSession : session.defaultSession
    }
  })

  win.addBrowserView(view)
  view.setBounds({
    x: 0,
    y: 0,
    width: 0,
    height: 0
  })
  view.setAutoResize({ width: false, height: false })
  await applyTabListeners(view)
  if (url === '') {
    const urlHash = encode('‎', true)
    router(view, `search?id=none&url=${urlHash}&verify=6713de00-4386-4a9f-aeb9-0949b3e71eb7`)
    focusSearch(windowId)
  } else {
    await view.webContents.loadURL(url)
  }
  // view.webContents.openDevTools({ mode: 'detach' })
  return view.webContents.id
}

export async function getTabs(windowId: number, favicon = '') {
  const tabs: {
    id: number
    title: string
    url: string
    favicon: string
    navigation: {
      isLoading: boolean
      canGoBack: boolean
      canGoForward: boolean
    }
  }[] = []
  const win = BrowserWindow.fromId(windowId)
  if (win === null) return []
  for (const elem of win.getBrowserViews()) {
    if (
      elem != null &&
      elem.webContents != null &&
      elem.webContents.id != (await getHeader(win!)).webContents.id &&
      !(await isOverlay(elem)) &&
      !elem.webContents.getURL().includes('f1f0313f-8a5b-4ffd-b137-167fb439ddb0')
    ) {
      try {
        const favicon_url = await getFavicon(elem)
        let fav: any
        if (elem.webContents !== null) {
          console.log('getting fav data', elem.webContents.getURL())
          fav = await getFaviconData(
            elem.webContents.getURL() === null ? '' : elem.webContents.getURL(),
            favicon !== '' ? favicon : favicon_url
          )
        }
        if (elem.webContents !== null) {
          const tab = {
            id: elem.webContents.id,
            title: elem.webContents.getTitle() ?? 'no title',
            url: elem.webContents.getURL(),
            favicon: fav,
            navigation: {
              isLoading: elem.webContents.isLoading(),
              canGoBack: elem.webContents.canGoBack(),
              canGoForward: elem.webContents.canGoForward()
            }
          }
          if (elem.webContents.getURL().includes('c8c75395-ae19-435d-8683-21109a112d6e')) {
            tab.url = ''
          }
          tabs.push(tab)
        }
      } catch (e) {
        console.log('error occured', e)
      }
    }
  }
  return tabs
}

export async function hideTab(tabId: number) {
  const view = getViewById(tabId)
  if (view == null) return
  view.setBounds({ x: 0, y: 0, width: 0, height: 0 })
  view.setAutoResize({ width: false, height: false })
}

export async function showTab(tabId: number) {
  const view = getViewById(tabId)
  if (view == null) return
  const win = BrowserWindow.fromBrowserView(view)
  if (win == null) return
  const wb = win.getBounds()
  view.setBounds({
    x: 0,
    y: NAVIGATOR_HEIGHT,
    width: wb.width,
    height: wb.height - NAVIGATOR_HEIGHT
  })
  view.setAutoResize({ width: true, height: true })
}

export function isTabHidden(tabId: number) {
  const view = getViewById(tabId)
  if (view == null) return
  const bounds = view.getBounds()
  if (bounds.width + bounds.height === 0) {
    return true
  }
  return false
}

export async function goBack(tabId: number) {
  const view = getViewById(tabId)
  if (view === null) return
  if (view.webContents.canGoBack()) {
    view.webContents.goBack()
  }
}

export async function goForward(tabId: number) {
  const view = getViewById(tabId)
  if (view === null) return
  if (view.webContents.canGoForward()) {
    view.webContents.goForward()
  }
}

export async function refreshTab(tabId: number) {
  const view = getViewById(tabId)
  if (view === null) return
  view.webContents.reload()
}

export async function focusSearch(windowId: number) {
  const win = BrowserWindow.fromId(windowId)
  if (win == null) return
  const header = await getHeader(win)
  if (header == null) return
  header.webContents.focus()
  header.webContents.send('focusing-search')
}

export async function moveTabs(tabIds: number[], newWindowId: number) {
  const newWindow = BrowserWindow.fromId(newWindowId)
  if (newWindow == null) return
  const newTabIds: number[] = []
  tabIds.forEach(async (id) => {
    const view = getViewById(id)
    if (view === null) return
    const oldWindow = BrowserWindow.fromBrowserView(view)
    if (oldWindow == null) return
    newWindow!.addBrowserView(view)
    await applyTabListeners(view)
    newTabIds.push(view.webContents.id)
  })
  await updateAllWindows()
  await selectTab(newTabIds[0])
}

export async function handleMoveTabs(tabIds: number[]) {
  const { x, y } = screen.getCursorScreenPoint()

  const windows = BrowserWindow.getAllWindows()
  if (tabIds.length == 0) return
  const sourceView = getViewById(tabIds[0])
  if (sourceView == null) return
  const sourceWindow = BrowserWindow.fromBrowserView(sourceView)
  if (sourceWindow == null) return
  for (const win of windows) {
    if (win == null) {
    }
    if (win != null && win.id != sourceWindow.id) {
      const header = await getHeader(win)

      const windowBoundsX = {
        left: win.getPosition()[0],
        right: win.getPosition()[0] + header.getBounds().width
      }
      const windowBoundsY = {
        top: win.getPosition()[1],
        bottom: win.getPosition()[1] + header.getBounds().height
      }
      if (
        x > windowBoundsX.left &&
        x < windowBoundsX.right &&
        y < windowBoundsY.bottom &&
        y > windowBoundsY.top
      ) {
        await moveTabs(tabIds, win.id)
        return false
      }
    }
  }
  return true
}

export async function updateAllWindows() {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (win == null) return
    const header = await getHeader(win)
    const tabs = await getTabs(win.id, '')
    if (tabs.length == 0) {
      deleteWindow(win.id)
    }
    header.webContents.send('tabs-updated', tabs)
  }
}

export async function getSelectedTab(win: BrowserWindow) {
  const tabs = await getTabs(win.id)
  const header = await getHeader(win)
  const overlay = await getOverlay(win)
  for (const tab of tabs) {
    try {
      if (tab.id !== header.webContents.id && tab.id !== overlay?.webContents.id) {
        console.log('TABID is not header/overlay')
        if (!isTabHidden(tab.id)) {
          return tab
        }
      }
    } catch (e) {}
  }
  return null
}

export function openInspect(view: BrowserView) {
  view.webContents.openDevTools({ mode: 'bottom' })
}
