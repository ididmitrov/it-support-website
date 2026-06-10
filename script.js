const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".main-nav");
const year = document.querySelector("#year");
const form = document.querySelector(".contact-form");
const revealCards = document.querySelectorAll(".reveal-card");

if (year) {
  year.textContent = new Date().getFullYear();
}

if (navToggle && nav) {
  navToggle.addEventListener("click", () => {
    const isOpen = nav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  nav.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    });
  });
}

if (form) {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    alert("Благодарим! Формата е в демо режим и не изпраща реално съобщение.");
  });
}

if (revealCards.length) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );

  revealCards.forEach((card, index) => {
    card.style.transitionDelay = `${index * 0.12}s`;
    observer.observe(card);
  });
}
