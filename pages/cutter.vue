<template>
  <div class="max-w-3xl mx-auto space-y-8 font-sans p-6">
    
    <div class="text-center">
      <h1 class="text-3xl font-extrabold text-gray-900">✂️ MP3 線上切割神器</h1>
      <p class="mt-3 text-gray-500">上傳音檔、試聽並標記範圍，由雲端伺服器為您精準切割。</p>
    </div>

    <!-- 上傳區塊 -->
    <div class="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
      <label class="block text-sm font-semibold text-gray-700 mb-2">步驟一：選擇音檔 (支援 MP3, M4A, 3GP 等)</label>
      <input type="file" accept="audio/*, video/*" @change="handleFileLoad" class="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100" />
      
      <!-- 試聽播放器 -->
      <div v-if="audioUrl" class="mt-6">
        <label class="block text-sm font-semibold text-gray-700 mb-2">試聽與定位</label>
        <audio ref="audioPlayer" :src="audioUrl" controls class="w-full rounded-md outline-none"></audio>
      </div>
    </div>

    <!-- 切割模式選擇 -->
    <div v-if="audioUrl" class="bg-white p-6 rounded-xl shadow-sm border border-gray-200 space-y-6">
      <div>
        <label class="block text-sm font-semibold text-gray-700 mb-3">步驟二：選擇切割模式</label>
        <div class="flex gap-4">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" v-model="cutMode" value="segment" class="text-indigo-600 focus:ring-indigo-500">
            <span>精準擷取 (自訂頭尾)</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="radio" v-model="cutMode" value="interval" class="text-indigo-600 focus:ring-indigo-500">
            <span>等分切割 (按時間間隔)</span>
          </label>
        </div>
      </div>

      <!-- 模式 A：精準擷取 -->
      <div v-if="cutMode === 'segment'" class="p-4 bg-gray-50 rounded-lg flex flex-col sm:flex-row gap-4">
        <div class="w-full">
          <label class="block text-xs text-gray-500 mb-1">起點時間 (秒)</label>
          <div class="flex gap-2">
            <input type="number" step="0.1" v-model="startTime" class="w-full p-2 border rounded-md">
            <button @click="setStartTime" class="whitespace-nowrap px-3 bg-gray-200 hover:bg-gray-300 rounded-md text-sm">設為目前播放</button>
          </div>
        </div>
        <div class="w-full">
          <label class="block text-xs text-gray-500 mb-1">終點時間 (秒)</label>
          <div class="flex gap-2">
            <input type="number" step="0.1" v-model="endTime" class="w-full p-2 border rounded-md">
            <button @click="setEndTime" class="whitespace-nowrap px-3 bg-gray-200 hover:bg-gray-300 rounded-md text-sm">設為目前播放</button>
          </div>
        </div>
      </div>

      <!-- 模式 B：等分切割 -->
      <div v-if="cutMode === 'interval'" class="p-4 bg-gray-50 rounded-lg">
        <label class="block text-xs text-gray-500 mb-1">每幾秒切割一段？</label>
        <div class="flex items-center gap-2">
          <input type="number" v-model="intervalSec" class="w-32 p-2 border rounded-md" placeholder="例如: 30">
          <span class="text-sm text-gray-600">秒</span>
        </div>
      </div>

      <!-- 送出按鈕 -->
      <button 
        @click="processAudio" 
        :disabled="isProcessing"
        class="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-md transition-colors disabled:bg-gray-400"
      >
        {{ isProcessing ? '雲端處理中，請稍候...' : '🚀 送出切割' }}
      </button>
    </div>

    <!-- 成功下載提示 -->
    <div v-if="downloadUrl" class="bg-green-50 p-4 rounded-xl border border-green-200 flex justify-between items-center">
      <span class="text-green-700 font-medium">✅ 處理完成！</span>
      <a :href="downloadUrl" :download="downloadFilename" class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-bold">
        點此下載檔案
      </a>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue'

const HF_API_URL = 'https://lawxstudents168-3gp2mp3-api.hf.space/api'

const rawFile = ref(null)
const audioUrl = ref(null)
const audioPlayer = ref(null)

const cutMode = ref('segment') // 'segment' 或是 'interval'
const startTime = ref(0)
const endTime = ref(0)
const intervalSec = ref(30)

const isProcessing = ref(false)
const downloadUrl = ref(null)
const downloadFilename = ref('output.mp3')

// 載入本地檔案進行試聽
const handleFileLoad = (event) => {
  const file = event.target.files[0]
  if (!file) return

  rawFile.value = file
  // 建立本地虛擬網址給 audio 標籤播放
  if (audioUrl.value) URL.revokeObjectURL(audioUrl.value)
  audioUrl.value = URL.createObjectURL(file)
  
  // 重置狀態
  downloadUrl.value = null
  startTime.value = 0
  endTime.value = 0
}

// 快速設定時間
const setStartTime = () => {
  if (audioPlayer.value) startTime.value = Number(audioPlayer.value.currentTime.toFixed(1))
}
const setEndTime = () => {
  if (audioPlayer.value) endTime.value = Number(audioPlayer.value.currentTime.toFixed(1))
}

// 送出到後端處理
const processAudio = async () => {
  if (!rawFile.value) return alert('請先選擇檔案')
  if (cutMode.value === 'segment' && Number(endTime.value) <= Number(startTime.value)) {
    return alert('終點時間必須大於起點時間！')
  }
  if (cutMode.value === 'interval' && Number(intervalSec.value) <= 0) {
    return alert('切割間隔必須大於 0！')
  }

  isProcessing.value = true
  downloadUrl.value = null

  const formData = new FormData()
  formData.append('file', rawFile.value)
  formData.append('mode', cutMode.value)
  
  if (cutMode.value === 'segment') {
    formData.append('start', startTime.value)
    formData.append('end', endTime.value)
  } else {
    formData.append('interval', intervalSec.value)
  }

  try {
    const response = await fetch(`${HF_API_URL}/cut`, {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(err)
    }

    // 後端如果是分段，會回傳 ZIP 檔；如果是單一擷取，會回傳 MP3
    const contentDisposition = response.headers.get('Content-Disposition')
    let filename = cutMode.value === 'interval' ? 'segments.zip' : 'cut_audio.mp3'
    if (contentDisposition && contentDisposition.includes('filename=')) {
      filename = contentDisposition.split('filename=')[1].replace(/"/g, '')
    }
    
    downloadFilename.value = filename
    const blob = await response.blob()
    downloadUrl.value = window.URL.createObjectURL(blob)

  } catch (error) {
    console.error(error)
    alert('處理失敗: ' + error.message)
  } finally {
    isProcessing.value = false
  }
}
</script>