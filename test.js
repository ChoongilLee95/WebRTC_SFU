let hi = {
  number: 1,
};

let bye = [];

bye.push(hi);

console.log(bye[0].number);

bye.forEach((e) => {
  e.number = 3;
});

console.log(bye[0].number);

hi["a"]["b"] = 3;

console.log(hi);
