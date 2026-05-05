// server/api/cobalt.post.js
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // 準備多個 Cobalt 開源節點，如果一個被擋，就自動切換下一個！
  const endpoints = [
    'https://api.cobalt.tools/api/json',
    'https://cobalt-api.kwiateks.com/api/json',
    'https://co.wuk.sh/api/json'
  ]

  let lastError = ''

  // 依序嘗試每個節點
  for (const api of endpoints) {
    try {
      const response = await fetch(api, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          // 🔴 終極偽裝術：假裝這是一個真實的 Chrome 瀏覽器在官方網站上發出的請求
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Origin': 'https://cobalt.tools',
          'Referer': 'https://cobalt.tools/'
        },
        body: JSON.stringify(body)
      })

      if (response.ok) {
        // 如果成功，馬上回傳資料給前端
        const data = await response.json()
        return data
      } else {
        // 如果被擋，記錄錯誤並繼續嘗試下一個節點
        const errText = await response.text()
        lastError = `[${api}] 拒絕請求 (${response.status})`
        console.error(lastError, errText)
      }
    } catch (error) {
      lastError = `[${api}] 連線失敗`
      console.error(lastError, error.message)
    }
  }

  // 如果全部節點都陣亡，把詳細錯誤訊息丟給前端，不再只是顯示無用的 500
  throw createError({
    statusCode: 500,
    statusMessage: '解析伺服器全數失效。錯誤資訊: ' + lastError
  })
})