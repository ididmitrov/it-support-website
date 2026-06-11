const navToggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".main-nav");
const year = document.querySelector("#year");
const form = document.querySelector(".contact-form");
const revealCards = document.querySelectorAll(".reveal-card");
const isEnglish = document.documentElement.lang === "en";

const FORM_GUARD = {
  cooldownMs: 30_000,
  maxPerHour: 5,
  minDwellMs: 3_000,
  successMessageMs: 5_000,
  storagePrefix: "mi-assist-form-",
};

const formCopy = {
  sending: isEnglish ? "Sending..." : "Изпращане...",
  submit: isEnglish ? "Send" : "Изпрати",
  success: isEnglish
    ? "Your inquiry was sent successfully. We will contact you soon."
    : "Успешно изпратено запитване. Ще се свържем с Вас скоро.",
  error: isEnglish
    ? "Something went wrong. Please try again or call us directly."
    : "Възникна грешка. Моля, опитайте отново или се обадете директно.",
  invalid: isEnglish
    ? "Please fill in all required fields."
    : "Моля, попълнете всички задължителни полета.",
  tooFast: isEnglish
    ? "Please wait a moment before sending the form."
    : "Моля, изчакайте малко преди да изпратите формата.",
  cooldown: (seconds) =>
    isEnglish
      ? `Please wait ${seconds}s before sending again.`
      : `Моля, изчакайте ${seconds} сек. преди повторно изпращане.`,
  hourlyLimit: isEnglish
    ? "Submission limit reached. Try again later or call us directly."
    : "Достигнахте лимита за изпращания. Опитайте по-късно или се обадете директно.",
  busy: isEnglish
    ? "Your message is already being sent."
    : "Съобщението вече се изпраща.",
  phoneRequired: isEnglish
    ? "Please enter a phone number."
    : "Моля, въведете телефонен номер.",
  phoneInvalid: isEnglish
    ? "Invalid phone number."
    : "Невалиден телефонен номер.",
  phoneTooShort: isEnglish
    ? "Phone number is too short for the selected country."
    : "Телефонният номер е твърде кратък за избраната държава.",
  phoneTooLong: isEnglish
    ? "Phone number is too long for the selected country."
    : "Телефонният номер е твърде дълъг за избраната държава.",
  phoneBadCountry: isEnglish
    ? "Invalid country code."
    : "Невалиден код на държава.",
};

const PHONE_UTILS_URL =
  "https://cdn.jsdelivr.net/npm/intl-tel-input@24.6.0/build/js/utils.js";

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
  const submitButton = form.querySelector('button[type="submit"]');
  const feedback = form.querySelector(".form-feedback");
  const phoneInput = form.querySelector("#phone");
  const phoneField = form.querySelector(".phone-field");
  const submitFrame = document.getElementById("formsubmit-iframe");
  const formReadyAt = Date.now();
  let phoneInputInstance = null;

  const normalizeNationalPhone = () => {
    if (!phoneInputInstance || !phoneInput) {
      return;
    }

    const countryData = phoneInputInstance.getSelectedCountryData();
    const rawValue = phoneInput.value.trim();

    if (!countryData?.dialCode || !rawValue.startsWith("0")) {
      return;
    }

    const withoutTrunkZero = rawValue.replace(/^0+/, "");
    if (!withoutTrunkZero) {
      return;
    }

    phoneInputInstance.setNumber(`+${countryData.dialCode}${withoutTrunkZero}`);
  };

  let isSubmitting = false;
  let awaitingFrameResponse = false;
  let responseTimer = null;
  let successHideTimer = null;
  let cooldownTimer = null;

  const storageKey = (name) => `${FORM_GUARD.storagePrefix}${name}`;

  const getHourlySubmitCount = () => {
    const now = Date.now();
    const windowStart = Number(sessionStorage.getItem(storageKey("window")) || 0);

    if (!windowStart || now - windowStart > 3_600_000) {
      sessionStorage.setItem(storageKey("window"), String(now));
      sessionStorage.setItem(storageKey("count"), "0");
      return 0;
    }

    return Number(sessionStorage.getItem(storageKey("count")) || 0);
  };

  const recordSubmissionAttempt = () => {
    const count = getHourlySubmitCount();
    sessionStorage.setItem(storageKey("count"), String(count + 1));
    sessionStorage.setItem(storageKey("last"), String(Date.now()));
  };

  const getCooldownRemainingMs = () => {
    const lastSubmit = Number(sessionStorage.getItem(storageKey("last")) || 0);
    if (!lastSubmit) {
      return 0;
    }

    return Math.max(0, FORM_GUARD.cooldownMs - (Date.now() - lastSubmit));
  };

  const getSubmitBlockReason = () => {
    if (isSubmitting) {
      return formCopy.busy;
    }

    if (Date.now() - formReadyAt < FORM_GUARD.minDwellMs) {
      return formCopy.tooFast;
    }

    const cooldownMs = getCooldownRemainingMs();
    if (cooldownMs > 0) {
      return formCopy.cooldown(Math.ceil(cooldownMs / 1000));
    }

    if (getHourlySubmitCount() >= FORM_GUARD.maxPerHour) {
      return formCopy.hourlyLimit;
    }

    return null;
  };

  const setSubmitDisabled = (disabled) => {
    if (submitButton) {
      submitButton.disabled = disabled;
    }
  };

  const scheduleCooldownUnlock = () => {
    if (cooldownTimer) {
      clearTimeout(cooldownTimer);
    }

    const remainingMs = getCooldownRemainingMs();
    if (remainingMs <= 0) {
      setSubmitDisabled(false);
      return;
    }

    setSubmitDisabled(true);
    cooldownTimer = setTimeout(() => {
      cooldownTimer = null;
      if (!isSubmitting) {
        setSubmitDisabled(false);
        if (submitButton) {
          submitButton.textContent = formCopy.submit;
        }
      }
    }, remainingMs);
  };

  const setFeedback = (message, type) => {
    if (!feedback) {
      return;
    }

    feedback.textContent = message;
    feedback.hidden = false;
    feedback.classList.remove("is-success", "is-error");
    feedback.classList.add(type === "success" ? "is-success" : "is-error");
  };

  const clearFeedback = () => {
    if (successHideTimer) {
      clearTimeout(successHideTimer);
      successHideTimer = null;
    }

    if (!feedback) {
      return;
    }

    feedback.hidden = true;
    feedback.textContent = "";
    feedback.classList.remove("is-success", "is-error", "is-hiding");
  };

  if (phoneInput && window.intlTelInput) {
    phoneInputInstance = window.intlTelInput(phoneInput, {
      initialCountry: "bg",
      preferredCountries: ["bg", "gr", "ro", "de", "gb", "us"],
      separateDialCode: true,
      nationalMode: true,
      formatOnDisplay: true,
      autoPlaceholder: "off",
      loadUtilsOnInit: PHONE_UTILS_URL,
    });

    const clearPhoneInvalidState = () => {
      phoneField?.classList.remove("is-invalid");
    };

    phoneInput.addEventListener("input", clearPhoneInvalidState);
    phoneInput.addEventListener("countrychange", clearPhoneInvalidState);
    phoneInput.addEventListener("blur", normalizeNationalPhone);
  }

  const getPhoneValidationMessage = () => {
    if (!phoneInputInstance || !phoneInput) {
      return null;
    }

    normalizeNationalPhone();

    const nationalNumber = phoneInput.value.trim();
    if (!nationalNumber) {
      return formCopy.phoneRequired;
    }

    if (!phoneInputInstance.isValidNumber()) {
      const errorCode = phoneInputInstance.getValidationError();
      if (errorCode === 2) {
        return formCopy.phoneTooShort;
      }
      if (errorCode === 3) {
        return formCopy.phoneTooLong;
      }
      if (errorCode === 1) {
        return formCopy.phoneBadCountry;
      }
      return formCopy.phoneInvalid;
    }

    return null;
  };

  const resetPhoneField = () => {
    if (!phoneInputInstance) {
      return;
    }

    phoneInputInstance.setNumber("");
    phoneInputInstance.setCountry("bg");
    phoneField?.classList.remove("is-invalid");
  };

  const scheduleSuccessAutoHide = () => {
    if (successHideTimer) {
      clearTimeout(successHideTimer);
    }

    successHideTimer = setTimeout(() => {
      if (feedback) {
        feedback.classList.add("is-hiding");
      }

      successHideTimer = setTimeout(() => {
        clearFeedback();
      }, 300);
    }, FORM_GUARD.successMessageMs);
  };

  const finishSubmission = (type) => {
    if (responseTimer) {
      clearTimeout(responseTimer);
      responseTimer = null;
    }

    awaitingFrameResponse = false;
    isSubmitting = false;

    if (submitButton) {
      submitButton.textContent = formCopy.submit;
    }

    scheduleCooldownUnlock();

    if (type === "success") {
      form.reset();
      resetPhoneField();
      setFeedback(formCopy.success, "success");
      feedback?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      scheduleSuccessAutoHide();
      return;
    }

    setFeedback(formCopy.error, "error");
  };

  if (submitFrame) {
    submitFrame.addEventListener("load", () => {
      if (!awaitingFrameResponse) {
        return;
      }

      finishSubmission("success");
    });
  }

  scheduleCooldownUnlock();

  form.addEventListener("submit", (event) => {
    clearFeedback();

    const blockReason = getSubmitBlockReason();
    if (blockReason) {
      event.preventDefault();
      setFeedback(blockReason, "error");
      scheduleCooldownUnlock();
      return;
    }

    if (!form.checkValidity()) {
      event.preventDefault();
      form.reportValidity();
      setFeedback(formCopy.invalid, "error");
      return;
    }

    const phoneValidationMessage = getPhoneValidationMessage();
    if (phoneValidationMessage) {
      event.preventDefault();
      phoneField?.classList.add("is-invalid");
      phoneInput?.focus();
      setFeedback(phoneValidationMessage, "error");
      return;
    }

    if (phoneInputInstance && phoneInput) {
      normalizeNationalPhone();
      phoneInput.value = phoneInputInstance.getNumber();
    }

    const honey = form.querySelector('input[name="_honey"]');
    if (honey && honey.value.trim()) {
      event.preventDefault();
      return;
    }

    if (!submitFrame) {
      event.preventDefault();
      setFeedback(formCopy.error, "error");
      return;
    }

    isSubmitting = true;
    awaitingFrameResponse = true;
    recordSubmissionAttempt();

    setSubmitDisabled(true);
    if (submitButton) {
      submitButton.textContent = formCopy.sending;
    }

    responseTimer = setTimeout(() => {
      if (!awaitingFrameResponse) {
        return;
      }

      finishSubmission("error");
    }, 20_000);
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
