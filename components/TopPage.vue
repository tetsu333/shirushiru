<template>
  <div>
    <video ref="video" autoplay playsinline width="100%" />
    <button @click="toggleRecognition">
      {{ isRecognizing ? '停止' : '音声認識開始' }}
    </button>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const video = ref(null)
const stream = ref(null)
const isRecognizing = ref(false)
const transcript = ref('')
let recognition = null

const isMobile = () => /iPhone|Android.+Mobile/.test(navigator.userAgent)

const startCamera = async () => {
  try {
    const constraints = {
      video: {
        facingMode: isMobile() ? 'environment' : 'user'
      }
    }
    stream.value = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = stream.value
  } catch (err) {
    alert('カメラを起動できませんでした: ' + err.message)
  }
}

const speakText = (text) => {
  if (!window.speechSynthesis) {
    alert("このブラウザは音声読み上げに対応していません。")
    return
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'ja-JP'

  speechSynthesis.speak(utterance)
}

const captureAndSendToOpenAI = async (t) => {
  // 入力音声を表示
  console.log(t)

  const videoEl = video.value
  if (!videoEl) return

  // 元のvideoサイズを取得
  const originalWidth = videoEl.videoWidth
  const originalHeight = videoEl.videoHeight

  // リサイズ後のサイズを決定（横幅320px固定、縦横比維持）
  const targetWidth = 320
  const aspectRatio = originalHeight / originalWidth
  const targetHeight = Math.round(targetWidth * aspectRatio)

  // canvasサイズを縮小
  const canvas = document.createElement('canvas')
  canvas.width = targetWidth
  canvas.height = targetHeight

  // 描画（ここで縮小される）
  const ctx = canvas.getContext('2d')
  ctx.drawImage(videoEl, 0, 0, targetWidth, targetHeight)

  // Base64形式（data URL）を取得
  const base64Image = canvas.toDataURL('image/jpeg')

  const OPENAI_API_KEY = useRuntimeConfig().public.OPENAI_API_KEY

  // OpenAI APIへ送信
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              },
              {
                type: 'text',
                text: t
              }
            ]
          }
        ],
        max_tokens: 300
      })
    })

    if (!response.ok) {
      throw new Error(`OpenAIリクエスト失敗: ${response.status}`)
    }

    const result = await response.json()

    const aiText = result.choices[0]?.message?.content
    console.log(aiText)
    speakText(aiText)
  } catch (err) {
    alert('送信エラー: ' + err.message)
  }
}

// ボタンクリックで開始／停止
const toggleRecognition = () => {
  const dummyUtterance = new SpeechSynthesisUtterance('')
  speechSynthesis.speak(dummyUtterance)

  if (!recognition) {
    alert('このブラウザはWeb Speech APIに対応していません')
    return
  }
  if (isRecognizing.value) {
    recognition.stop()
    isRecognizing.value = false
  } else {
    transcript.value = ''
    recognition.start()
    isRecognizing.value = true
  }
}

onMounted(() => {
  startCamera()

  try {
    recognition = new window.webkitSpeechRecognition()
    recognition.lang = 'ja-JP'
    recognition.continuous = false
    recognition.interimResults = false

    // 認識結果を取得
    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript
      transcript.value = text
    }

    // 終了時フラグを戻して、音声を送信
    recognition.onend = () => {
      isRecognizing.value = false
      captureAndSendToOpenAI(transcript.value)
    }
  } catch (error) {
    console.error('Web Speech APIが利用できません:', error)
  }
})
</script>
