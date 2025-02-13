const coords = { x: 0, y: 0 };
const colors = [
  "aqua",
  "red",
  "blue",
  "blueviolet",
  "rgb(190, 130, 246)",
  "rgb(130, 246, 246)",
  "rgb(122, 233, 170)",
  "rgb(1, 124, 54)",
  "rgb(241, 250, 111)",
  "rgb(255, 7, 164)",
  "rgb(218, 94, 0)",
];

function throttle(func, delay) {
  let lastCall = 0;
  let timeoutId;

  return function (...args) {
    const now = Date.now();
    const timeSinceLastCall = now - lastCall;

    if (timeSinceLastCall >= delay) {
      lastCall = now;
      func.apply(this, args);
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        lastCall = Date.now();
        func.apply(this, args);
      }, delay - timeSinceLastCall);
    }
  };
}

window.addEventListener("mousemove", function (e) {
  oldX = coords.x;
  oldY = coords.y;
  coords.x = e.clientX;
  coords.y = e.clientY;

  deltaX = coords.x - oldX;
  deltaY = coords.y - oldY;

  //   slope = deltaY / deltaX;
  spawningCoordsX = coords.x - deltaX * 10;
  spawningCoordsY = coords.y - deltaY * 10;

  if (
    Math.abs(spawningCoordsX - coords.x) > 10 ||
    Math.abs(spawningCoordsY - coords.y) > 10
  ) {
    maybeSpawnStar(spawningCoordsX, spawningCoordsY);
  }
});

const pathText1 =
  '<path viewBox="0 0 1235 1175" height="24" width="24" d="M 0,449 H 1235 L 236,1175 618,0 1000,1175 z" id="path4" style="fill:';
const pathText2 = ';fill-opacity:1" />';
function spawnStar(spawningCoordsX, spawningCoordsY) {
  const svgNS = "http://www.w3.org/2000/svg";
  const sprite = document.createElementNS(svgNS, "svg");
  sprite.style.width = "24";
  sprite.style.height = "24";
  sprite.setAttribute("viewBox", "0 0 1235 1175");
  sprite.id = "svg2";
  sprite.xmlns = "http://www.w3.org/2000/svg";
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  sprite.innerHTML = pathText1 + randomColor + pathText2;

  sprite.classList.add("sprite");
  sprite.style.left = spawningCoordsX - 12 + "px";
  sprite.style.top = spawningCoordsY - 12 + "px";
  sprite.classList.add("active");
  setTimeout(() => {
    sprite.style.height = "0px";
    sprite.style.width = "0px";
    document.body.removeChild(sprite);
  }, 2000);
  document.body.appendChild(sprite);
}

const maybeSpawnStar = throttle(spawnStar, 70);
