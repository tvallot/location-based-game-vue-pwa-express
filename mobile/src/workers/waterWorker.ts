/// <reference lib="webworker" />

type Bubble = { x: number; y: number; radius: number; alpha: number; speed: number }

type WorkerMessage =
  | {
      type: 'init'
      canvas: OffscreenCanvas
      width: number
      height: number
      bubbleCount: number
      bubbleMinRadius: number
      bubbleMaxRadius: number
    }
  | { type: 'resize'; width: number; height: number }
  | { type: 'stop' }

let canvas: OffscreenCanvas | null = null
let ctx: OffscreenCanvasRenderingContext2D | null = null
let width = 0
let height = 0
let time = 0
let running = false
let settings = { bubbleCount: 60, bubbleMinRadius: 2, bubbleMaxRadius: 8 }
let bubbles: Bubble[] = []

function spawnBubbles() {
  const { bubbleCount, bubbleMinRadius, bubbleMaxRadius } = settings
  bubbles = Array.from({ length: bubbleCount }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    radius: bubbleMinRadius + Math.random() * (bubbleMaxRadius - bubbleMinRadius),
    alpha: 0.25 + Math.random() * 0.75,
    speed: 0.2 + Math.random() * 0.8,
  }))
}

function resize(newWidth: number, newHeight: number) {
  width = newWidth
  height = newHeight
  if (canvas) {
    canvas.width = width
    canvas.height = height
  }
  spawnBubbles()
}

function drawFrame() {
  if (!ctx) return
  ctx.clearRect(0, 0, width, height)

  // Blue tint
  const tint = ctx.createLinearGradient(0, 0, 0, height)
  tint.addColorStop(0, 'rgba(0,120,170,0.25)')
  tint.addColorStop(1, 'rgba(0,60,100,0.25)')
  ctx.fillStyle = tint
  ctx.fillRect(0, 0, width, height)

  // Wave
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'
  ctx.beginPath()
  for (let x = 0; x <= width; x += 4) {
    const y = height / 2 + Math.sin((x + time * 2) * 0.02) * 20
    if (x === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  // Rising bubbles
  for (const bubble of bubbles) {
    bubble.y -= bubble.speed * 0.6
    if (bubble.y < -10) bubble.y = height + 10

    const gradient = ctx.createRadialGradient(
      bubble.x,
      bubble.y,
      2,
      bubble.x,
      bubble.y,
      bubble.radius,
    )
    gradient.addColorStop(0, `rgba(255,255,255,${bubble.alpha})`)
    gradient.addColorStop(1, 'rgba(64,224,208,0)')

    ctx.beginPath()
    ctx.fillStyle = gradient
    ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2)
    ctx.fill()
  }

  time += 0.5
}

function loop() {
  if (!running) return
  drawFrame()
  requestAnimationFrame(loop)
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data

  switch (message.type) {
    case 'init':
      canvas = message.canvas
      ctx = canvas.getContext('2d')
      settings = {
        bubbleCount: message.bubbleCount,
        bubbleMinRadius: message.bubbleMinRadius,
        bubbleMaxRadius: message.bubbleMaxRadius,
      }
      resize(message.width, message.height)
      running = true
      loop()
      break
    case 'resize':
      resize(message.width, message.height)
      break
    case 'stop':
      running = false
      break
  }
}
