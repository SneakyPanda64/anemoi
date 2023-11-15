import { HistoryItem } from '@renderer/interfaces'
import { useEffect, useState } from 'react'
import Fuse from 'fuse.js'

export default function HistoryPage() {
  const [history, setHistory] = useState<Array<any>>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState(history)
  const options = {
    keys: ['title', 'url']
  }
  const fuse = new Fuse(history, options)

  const handleSearch = (e: any) => {
    const { value } = e.target
    setSearchTerm(value)
    setSearchResults(fuse.search(value))
  }

  useEffect(() => {
    window.indexBridge?.history.getHistory((items) => {
      console.log(items)
      setHistory(items)
    })
  }, [])
  const searchComponent = () => {
    return (
      <div className="mt-6 mb-8">
        <h1 className="text-2xl py-2">Search History</h1>
        <input
          value={searchTerm}
          onChange={handleSearch}
          placeholder="search history"
          className="w-1/3 bg-s-dark-gray p-2 rounded-xl ring-0 outline-none px-4"
        />
      </div>
    )
  }
  const handleHistoryClick = (url: string) => {
    console.log('creating new tab2')
    window.indexBridge?.tabs.newTab(() => {
      console.log('new tab created!')
    }, url)
  }
  const historyComponent = (item: HistoryItem) => {
    return (
      <div
        onClick={() => handleHistoryClick(item.url)}
        key={item.id}
        className="bg-s-dark-gray my-2 p-4 rounded-xl hover:bg-s-blue hover:bg-opacity-20 hover:cursor-pointer"
      >
        <div className="grid grid-cols-2">
          <div className="flex truncate w-2/3">
            <img
              className={`w-4 h-4 ml-1 mr-2 my-auto select-none `}
              src={`data:image/jpeg;charset=utf-8;base64,${item.favicon}`}
              style={{ display: 'none' }}
              width={15}
              height={15}
              onLoad={(e) => (e.currentTarget.style.display = 'block')}
              onLoadStart={(e) => (e.currentTarget.style.display = 'none')}
              onError={(e) => {
                console.log('error with loading favicon!')
                e.currentTarget.style.display = 'none'
              }}
            />
            <h1 className="truncate">{item.title}</h1>
          </div>
          <div className="w-1/2 truncate">{item.url}</div>
        </div>
      </div>
    )
  }
  return (
    <div className="w-full mx-4 ">
      {searchComponent()}
      {searchTerm == '' ? (
        history.map((result) => {
          return (result.url ?? '').length > 1 && result.query == null ? (
            historyComponent({
              id: result.id,
              favicon: result.favicon,
              title: result.title,
              url: result.url,
              timestamp: result.timestamp
            })
          ) : (
            <></>
          )
        })
      ) : searchResults.length > 0 ? (
        searchResults.map((result) => {
          return (result.item.url ?? '').length > 1 && result.item.query == null ? (
            historyComponent({
              id: result.item.id,
              favicon: result.item.favicon,
              title: result.item.title,
              url: result.item.url,
              timestamp: result.item.timestamp
            })
          ) : (
            <></>
          )
        })
      ) : (
        <div>
          <h1 className="text-center pt-32 text-2xl">No results found :(</h1>
        </div>
      )}
    </div>
  )
}
