'use strict';

const API_URL = 'https://media2.edu.metropolia.fi/restaurant/api/v1';
const LANGUAGE = 'fi';

// Sovelluksen tila 
let restaurants = [];
let selectedRestaurant = null;
let nearestRestaurant = null;
let menuType = 'daily';
let user = null;

// HTML-elementit
const cityFilter = document.querySelector('#city-filter');
const companyFilter = document.querySelector('#company-filter');
const restaurantList = document.querySelector('#restaurant-list');
const listMessage = document.querySelector('#list-message');

const menuTitle = document.querySelector('#menu-title');
const menuAddress = document.querySelector('#menu-address');
const menuContent = document.querySelector('#menu-content');
const dailyButton = document.querySelector('#daily-button');
const weeklyButton = document.querySelector('#weekly-button');
const favouriteButton = document.querySelector('#favourite-button');

const userName = document.querySelector('#user-name');
const authToggle = document.querySelector('#auth-toggle');
const logoutButton = document.querySelector('#logout-button');
const authPanel = document.querySelector('#auth-panel');
const authMessage = document.querySelector('#auth-message');
const loginForm = document.querySelector('#login-form');
const registerForm = document.querySelector('#register-form');


// Luo HTML-elementin ja asettaa sille tekstin
const createElement = (tag, text, className) => {
  const element = document.createElement(tag);
  element.textContent = text;
  if (className) {
    element.className = className;
  }
  return element;
};

// Hakee JSONia palvelimelta. Heittää virheen, jos pyyntö epäonnistuu.
const fetchJson = async (url, options) => {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Pyyntö epäonnistui');
  }
  return data;
};

// Otsakkeet pyyntöihin, jotka vaativat kirjautumisen
const getAuthHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

// Laskee etäisyyden kilometreinä kahden koordinaattipisteen välillä
const getDistance = (lat1, lon1, lat2, lon2) => {
  const earthRadius = 6371;
  const toRadians = (degrees) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
};

// Ravintolat 

const loadRestaurants = async () => {
  try {
    restaurants = await fetchJson(`${API_URL}/restaurants`);
    restaurants.sort((a, b) => a.name.localeCompare(b.name));
    fillCityFilter();
    renderRestaurants();
  } catch (error) {
    listMessage.textContent = 'Ravintoloiden haku epäonnistui.';
  }
};

// Lisää kaupungit suodattimen valikkoon
const fillCityFilter = () => {
  const cities = [...new Set(restaurants.map((restaurant) => restaurant.city))]
    .filter(Boolean)
    .sort();

  cities.forEach((city) => {
    const option = createElement('option', city);
    option.value = city;
    cityFilter.append(option);
  });
};

const getFilteredRestaurants = () =>
  restaurants.filter((restaurant) => {
    const cityMatches = !cityFilter.value || restaurant.city === cityFilter.value;
    const companyMatches = !companyFilter.value || restaurant.company === companyFilter.value;
    return cityMatches && companyMatches;
  });

const renderRestaurants = () => {
  if (restaurants.length === 0) {
    return;
  }

  restaurantList.innerHTML = '';
  const filteredRestaurants = getFilteredRestaurants();

  if (filteredRestaurants.length === 0) {
    listMessage.textContent = 'Ei ravintoloita valituilla suodattimilla.';
    return;
  }
  listMessage.textContent = '';

  filteredRestaurants.forEach((restaurant) => {
    const item = document.createElement('li');
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'restaurant-card';

    if (selectedRestaurant && selectedRestaurant._id === restaurant._id) {
      card.classList.add('selected');
    }
    if (restaurant === nearestRestaurant) {
      card.classList.add('nearest');
    }

    const isFavourite = user && user.favouriteRestaurant === restaurant._id;
    const name = isFavourite ? `${restaurant.name} ★` : restaurant.name;

    card.append(
      createElement('span', name, 'restaurant-name'),
      createElement('span', restaurant.address),
      createElement('span', `${restaurant.postalCode} ${restaurant.city}`),
      createElement('span', restaurant.company, 'company')
    );

    if (restaurant === nearestRestaurant) {
      card.append(
        createElement('span', `Lähin ravintola (${restaurant.distance.toFixed(1)} km)`, 'badge')
      );
    }

    card.addEventListener('click', () => selectRestaurant(restaurant));
    item.append(card);
    restaurantList.append(item);
  });
};

const selectRestaurant = (restaurant) => {
  selectedRestaurant = restaurant;
  menuTitle.textContent = restaurant.name;
  menuAddress.textContent = `${restaurant.address}, ${restaurant.postalCode} ${restaurant.city} · ${restaurant.phone || ''}`;
  renderRestaurants();
  updateFavouriteButton();
  loadMenu();
};

// Ruokalistat

const createCourseTable = (courses) => {
  if (!courses || courses.length === 0) {
    return createElement('p', 'Ei ruokalistaa saatavilla.');
  }

  const table = document.createElement('table');
  const headerRow = table.createTHead().insertRow();
  ['Annos', 'Ruokavalio', 'Hinta'].forEach((title) => {
    headerRow.append(createElement('th', title));
  });

  const body = table.createTBody();
  courses.forEach((course) => {
    const row = body.insertRow();
    row.append(
      createElement('td', course.name || ''),
      createElement('td', course.diets || '-'),
      createElement('td', course.price || '-')
    );
  });

  return table;
};

const createDay = (title, courses) => {
  const day = document.createElement('article');
  day.className = 'day';
  day.append(createElement('h3', title), createCourseTable(courses));
  return day;
};

const loadMenu = async () => {
  if (!selectedRestaurant) {
    return;
  }

  menuContent.textContent = 'Ladataan ruokalistaa...';

  try {
    const url = `${API_URL}/restaurants/${menuType}/${selectedRestaurant._id}/${LANGUAGE}`;
    const data = await fetchJson(url);
    menuContent.innerHTML = '';

    if (menuType === 'daily') {
      menuContent.append(createDay('Tänään', data.courses));
    } else {
      data.days.forEach((day) => menuContent.append(createDay(day.date, day.courses)));
    }
  } catch (error) {
    menuContent.textContent = 'Ruokalistaa ei löytynyt.';
  }
};

const setMenuType = (type) => {
  menuType = type;
  dailyButton.classList.toggle('active', type === 'daily');
  weeklyButton.classList.toggle('active', type === 'weekly');
  loadMenu();
};

// Lähin ravintola

const findNearestRestaurant = () => {
  if (!navigator.geolocation) {
    return;
  }

  navigator.geolocation.getCurrentPosition((position) => {
    const { latitude, longitude } = position.coords;

    nearestRestaurant = restaurants.reduce((nearest, restaurant) => {
      if (!restaurant.location) {
        return nearest;
      }
      // API antaa koordinaatit järjestyksessä (pituuspiiri, leveyspiiri)
      const [restaurantLon, restaurantLat] = restaurant.location.coordinates;
      restaurant.distance = getDistance(latitude, longitude, restaurantLat, restaurantLon);
      return !nearest || restaurant.distance < nearest.distance ? restaurant : nearest;
    }, null);

    renderRestaurants();
  });
};

// kirjautuminen, rekisteröityminen, suosikkiravintola

const updateAuthUI = () => {
  const loggedIn = user !== null;
  userName.textContent = loggedIn ? `Hei, ${user.username}` : '';
  authToggle.hidden = loggedIn;
  logoutButton.hidden = !loggedIn;
  if (loggedIn) {
    authPanel.hidden = true;
  }
  updateFavouriteButton();
  renderRestaurants();
};

const updateFavouriteButton = () => {
  favouriteButton.hidden = !(user && selectedRestaurant);
  if (favouriteButton.hidden) {
    return;
  }
  const isFavourite = user.favouriteRestaurant === selectedRestaurant._id;
  favouriteButton.textContent = isFavourite ? 'Suosikkiravintola ★' : 'Aseta suosikiksi';
  favouriteButton.disabled = isFavourite;
};

// Valitsee käyttäjän suosikkiravintolan automaattisesti
const selectFavouriteRestaurant = () => {
  if (!user || !user.favouriteRestaurant) {
    return;
  }
  const favourite = restaurants.find((restaurant) => restaurant._id === user.favouriteRestaurant);
  if (favourite) {
    selectRestaurant(favourite);
  }
};

// Tarkistaa, onko selaimeen tallennettu kirjautumistunnus vielä voimassa
const checkToken = async () => {
  const token = localStorage.getItem('token');
  if (!token) {
    return;
  }
  try {
    user = await fetchJson(`${API_URL}/users/token`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    localStorage.removeItem('token');
  }
};

const login = async (event) => {
  event.preventDefault();
  const formData = new FormData(loginForm);

  try {
    const data = await fetchJson(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        password: formData.get('password'),
      }),
    });

    if (!data.token) {
      throw new Error(data.message);
    }

    localStorage.setItem('token', data.token);
    user = data.data;
    loginForm.reset();
    authMessage.textContent = '';
    updateAuthUI();
    selectFavouriteRestaurant();
  } catch (error) {
    authMessage.textContent = error.message;
  }
};

const register = async (event) => {
  event.preventDefault();
  const formData = new FormData(registerForm);

  try {
    const data = await fetchJson(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: formData.get('username'),
        email: formData.get('email'),
        password: formData.get('password'),
      }),
    });

    registerForm.reset();
    authMessage.textContent = 'Käyttäjä luotu. Voit nyt kirjautua sisään.';

    // Jos palvelin vaatii tilin aktivoinnin, näytetään aktivointilinkki
    if (data.activationUrl) {
      const link = createElement('a', ' Aktivoi tili tästä.');
      link.href = data.activationUrl;
      authMessage.append(link);
    }
  } catch (error) {
    authMessage.textContent = error.message;
  }
};

const logout = () => {
  localStorage.removeItem('token');
  user = null;
  updateAuthUI();
};

const setFavourite = async () => {
  try {
    await fetchJson(`${API_URL}/users`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ favouriteRestaurant: selectedRestaurant._id }),
    });
    user.favouriteRestaurant = selectedRestaurant._id;
    updateFavouriteButton();
    renderRestaurants();
  } catch (error) {
    alert(error.message);
  }
};

cityFilter.addEventListener('change', renderRestaurants);
companyFilter.addEventListener('change', renderRestaurants);
dailyButton.addEventListener('click', () => setMenuType('daily'));
weeklyButton.addEventListener('click', () => setMenuType('weekly'));
favouriteButton.addEventListener('click', setFavourite);

authToggle.addEventListener('click', () => {
  authPanel.hidden = !authPanel.hidden;
});
loginForm.addEventListener('submit', login);
registerForm.addEventListener('submit', register);
logoutButton.addEventListener('click', logout);

// Käynnistys

const init = async () => {
  await checkToken();
  updateAuthUI();
  await loadRestaurants();
  selectFavouriteRestaurant();
  findNearestRestaurant();
};

init();