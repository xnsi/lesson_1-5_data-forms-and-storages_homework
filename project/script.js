const CARD_STORAGE_KEY = "event-card";
const HINT_SESSION_KEY = "event-card:hint-shown";

const cardForm = document.querySelector(".card-form");
const sessionHint = document.querySelector("[data-session-hint]");
const statePanels = document.querySelectorAll("[data-state-panel]");
const workspaceStatus = document.querySelector(".workspace__status");
const cardFields = document.querySelectorAll("[data-card-field]");
const createButton = document.querySelector('[data-action="create"]');
const editButton = document.querySelector('[data-action="edit"]');
const cancelButton = document.querySelector('[data-action="cancel"]');
const deleteButton = document.querySelector('[data-action="delete"]');
let card = null;

function showState(state) {
  statePanels.forEach((panel) => {
    panel.hidden = panel.dataset.statePanel !== state;
  });

  workspaceStatus.textContent = {
    empty: "Карточки нет",
    editor: "Редактирование",
    viewer: "Карточка сохранена",
  }[state];
}

function renderCard() {
  cardFields.forEach((field) => {
    field.textContent = card[field.dataset.cardField] || "Не указано";
  });
}

function openEditor() {
  cardForm.reset();

  if (card) {
    Object.entries(card).forEach(([name, value]) => {
      cardForm.elements.namedItem(name).value = value;
    });
  }

  showState("editor");
  cardForm.elements.namedItem("title").focus();
}

createButton.addEventListener("click", openEditor);
editButton.addEventListener("click", openEditor);

cardForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const formData = new FormData(cardForm);

  const newCard = {
    title: formData.get("title"),
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    note: formData.get("note"),
  };

  try {
    localStorage.setItem(CARD_STORAGE_KEY, JSON.stringify(newCard));
  } catch {
    workspaceStatus.textContent = "Не удалось сохранить карточку. Данные остались в форме.";
    return;
  }

  card = newCard;
  renderCard();
  showState("viewer");
  editButton.focus();
});

cancelButton.addEventListener("click", () => {
  showState(card ? "viewer" : "empty");
  (card ? editButton : createButton).focus();
});

deleteButton.addEventListener("click", () => {
  try {
    localStorage.removeItem(CARD_STORAGE_KEY);
  } catch {
    workspaceStatus.textContent = "Не удалось удалить карточку. Попробуйте еще раз.";
    return;
  }

  card = null;
  cardForm.reset();
  showState("empty");
  createButton.focus();
});

showState("empty");

try {
  const savedCard = localStorage.getItem(CARD_STORAGE_KEY);

  if (savedCard !== null) {
    const data = JSON.parse(savedCard);

    if (
      data === null ||
      typeof data !== "object" ||
      !["title", "startDate", "endDate", "note"].every(
        (name) => typeof data[name] === "string",
      ) ||
      data.title.length < 3 ||
      data.title.length > 100 ||
      !data.startDate ||
      !data.endDate ||
      data.note.length > 500
    ) {
      throw new Error("Неверный формат карточки");
    }

    card = {
      title: data.title,
      startDate: data.startDate,
      endDate: data.endDate,
      note: data.note,
    };
    renderCard();
    showState("viewer");
  }
} catch {
  workspaceStatus.textContent = "Не удалось восстановить карточку. Можно создать новую.";
}

try {
  sessionHint.hidden = sessionStorage.getItem(HINT_SESSION_KEY) === "1";

  if (!sessionHint.hidden) {
    sessionStorage.setItem(HINT_SESSION_KEY, "1");
  }
} catch {
  sessionHint.hidden = false;
}

