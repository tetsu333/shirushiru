<template>
  <div>
    <video ref="video" autoplay playsinline width="100%" />
    <button @click="toggleRecognition" :disabled="isButtonDisabled">
      {{ isRecognizing ? '停止' : '音声認識開始' }}
    </button>
    <div v-if="transcript">プロンプト: {{ transcript }}</div>
  </div>
</template>

<script setup>

import { ref, onMounted } from 'vue'

const isButtonDisabled = ref(false)
const isRecognizing = ref(false)
const transcript = ref('')
const video = ref(null)
const stream = ref(null)

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

const captureAndSendToOpenAI = async () => {
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

  transcript.value = '日本語で答えてください。なお、返事に「日本語で答えます」や「この画像は」のような前置きは必要ありません。' + transcript.value

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
                text: transcript.value
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
  } finally {
    isButtonDisabled.value = false
  }
}

const recorder = ref(null)
const audioChunks = []

const startRecording = async () => {
  const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })

  recorder.value = new window.RecordRTC(audioStream, {
    type: 'audio',
    mimeType: 'audio/wav',
    recorderType: window.RecordRTC.StereoAudioRecorder,
    desiredSampRate: 16000
  })

  recorder.value.startRecording()
  isRecognizing.value = true
}

const stopRecording = () => {
  if (!recorder.value) return
  recorder.value.stopRecording(async () => {
    const audioBlob = recorder.value.getBlob()
    isRecognizing.value = false
    isButtonDisabled.value = true

    const formData = new FormData()
    formData.append('file', audioBlob, 'voice.wav')
    formData.append('model', 'whisper-1')
    formData.append('language', 'ja')

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${useRuntimeConfig().public.OPENAI_API_KEY}`,
      },
      body: formData
    })

    const data = await response.json()
    transcript.value = data.text
    captureAndSendToOpenAI()
  })
}

const toggleRecognition = () => {
  const dummyUtterance = new SpeechSynthesisUtterance('')
  speechSynthesis.speak(dummyUtterance)

  isRecognizing.value ? stopRecording() : startRecording()
}

onMounted(() => {
  startCamera()
})
</script>
