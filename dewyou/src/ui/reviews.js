import { REVIEWS } from '../data/content.js';

export const renderReviews = () => {
  const track = document.getElementById('reviews-track');
  track.innerHTML = REVIEWS.map(
    (r) => `
    <article class="review">
      <span class="review__stars" aria-label="5 estrellas">★★★★★</span>
      <p class="review__text">“${r.tx}”</p>
      <div class="review__who">
        <span class="review__av">${r.n[0]}</span>
        <span>${r.n}<small>${r.tag} · AgendaPro</small></span>
      </div>
    </article>`
  ).join('');
  return track;
};
