import type { PhotoSubject } from './photo-subjects'
import { getPoints, hasCompleted, hasFailedOnce, markCompleted, markFailed } from './points'
import { assetUrl } from './base-url'
import { playQuizCorrect, playDenied } from './sound'

export function createPhotoPopup(onPointsChange: (points: number) => void): (subject: PhotoSubject) => void {
  const backdrop = document.createElement('div')
  backdrop.id = 'photo-popup-backdrop'

  const card = document.createElement('div')
  card.id = 'photo-popup'
  backdrop.appendChild(card)

  const closeButton = document.createElement('button')
  closeButton.id = 'photo-popup-close'
  closeButton.textContent = '✕'
  card.appendChild(closeButton)

  const image = document.createElement('img')
  image.id = 'photo-popup-image'
  card.appendChild(image)

  const credit = document.createElement('div')
  credit.id = 'photo-popup-credit'
  card.appendChild(credit)

  const body = document.createElement('div')
  body.id = 'photo-popup-body'
  card.appendChild(body)

  function close() {
    backdrop.classList.remove('visible')
  }
  closeButton.addEventListener('click', close)
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close()
  })

  function render(subject: PhotoSubject) {
    image.src = assetUrl(`/photos/${subject.imageFile}`)
    image.alt = subject.label
    credit.textContent = `사진: ${subject.credit}`

    const alreadyDone = hasCompleted(subject.designation)
    const failedBefore = hasFailedOnce(subject.designation)
    const optionsHtml = subject.quiz.options
      .map(
        (option, i) =>
          `<label class="quiz-option"><input type="radio" name="quiz-option" value="${i}">${option}</label>`,
      )
      .join('')

    body.innerHTML = `
      <h2>${subject.label}</h2>
      <p class="photo-description">${subject.description}</p>
      <div class="quiz">
        <p class="quiz-question">${subject.quiz.question}</p>
        <div class="quiz-options">${optionsHtml}</div>
        <button class="quiz-submit" type="button">정답 확인</button>
        <p class="quiz-feedback"></p>
      </div>
      ${
        alreadyDone
          ? '<p class="quiz-done-note">이미 완료한 천체입니다 - 복습은 몇 번이든 가능하지만 포인트는 한 번만 지급돼요.</p>'
          : failedBefore
            ? '<p class="quiz-done-note">이미 한 번 오답을 제출한 문제예요 - 복습은 가능하지만 포인트는 지급되지 않아요.</p>'
            : ''
      }
    `

    const feedback = body.querySelector<HTMLParagraphElement>('.quiz-feedback')!
    const submit = body.querySelector<HTMLButtonElement>('.quiz-submit')!
    submit.addEventListener('click', () => {
      const picked = body.querySelector<HTMLInputElement>('input[name="quiz-option"]:checked')
      if (!picked) {
        feedback.textContent = '보기를 하나 선택해 주세요.'
        feedback.className = 'quiz-feedback'
        return
      }

      const correct = Number(picked.value) === subject.quiz.correctIndex
      if (!correct) {
        // 오답을 한 번이라도 내면 정답을 알려주므로, 이후 다시 골라 맞혀도
        // 실력이 아니라 암기이다 - markFailed로 영구히 포인트 지급 대상에서
        // 빼서 hasCompleted와 같은 "한 번만" 규칙을 따르게 한다.
        markFailed(subject.designation)
        feedback.textContent = `아쉬워요! 정답은 "${subject.quiz.options[subject.quiz.correctIndex]}"입니다.`
        feedback.className = 'quiz-feedback incorrect'
        playDenied()
        return
      }

      const awarded = markCompleted(subject.designation)
      feedback.textContent = awarded > 0 ? `정답입니다! +${awarded} 포인트 획득` : '정답입니다! (포인트는 지급되지 않아요)'
      feedback.className = 'quiz-feedback correct'
      playQuizCorrect()
      onPointsChange(getPoints())
    })
  }

  document.body.appendChild(backdrop)

  return (subject: PhotoSubject) => {
    render(subject)
    backdrop.classList.add('visible')
  }
}
