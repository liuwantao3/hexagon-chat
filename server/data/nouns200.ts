export const NOUNS_200: string[] = [
  "time", "year", "people", "way", "day", "man", "woman", "child", "boy", "girl",
  "baby", "friend", "family", "mother", "father", "sister", "brother", "grandma", "grandpa", "parent",
  "house", "home", "room", "bed", "table", "chair", "window", "door", "floor", "wall",
  "book", "story", "picture", "color", "toy", "game", "ball", "food", "water", "milk",
  "bread", "apple", "orange", "banana", "cake", "tree", "flower", "grass", "leaf", "plant",
  "dog", "cat", "bird", "fish", "animal", "horse", "cow", "sheep", "rabbit", "mouse",
  "hand", "foot", "head", "eye", "ear", "nose", "mouth", "hair", "face", "body",
  "sun", "moon", "star", "sky", "cloud", "rain", "snow", "wind", "fire", "earth",
  "world", "country", "city", "street", "road", "car", "bus", "train", "bike", "boat",
  "plane", "ship", "shop", "school", "park", "beach", "river", "lake", "mountain", "hill",
  "name", "word", "letter", "number", "phone", "clock", "watch", "bag", "box", "cup",
  "plate", "spoon", "fork", "knife", "glass", "bedroom", "bathroom", "kitchen", "garden", "yard",
  "morning", "afternoon", "evening", "night", "today", "tomorrow", "yesterday", "week", "month", "birthday",
  "party", "song", "dance", "music", "voice", "rainbow", "raincoat", "umbrella", "hat", "shoe",
  "sock", "glove", "scarf", "coat", "dress", "shirt", "pants", "skirt", "cap", "king",
  "queen", "prince", "princess", "teacher", "doctor", "nurse", "policeman", "farmer", "cook", "soldier",
  "sound", "noise", "light", "dark", "hot", "cold", "warm", "cool", "big", "small",
  "long", "short", "tall", "happy", "sad", "angry", "tired", "sleepy", "rice", "soup",
  "egg", "meat", "chicken", "cheese", "butter", "salt", "sugar", "tea", "juice", "fruit",
  "vegetable", "carrot", "potato", "tomato", "onion", "smile", "laugh", "cry", "wave", "jump"
]

export function getRandomNouns(count: number, exclude: string[] = []): string[] {
  const available = NOUNS_200.filter(n => !exclude.includes(n))
  const shuffled = [...available].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
