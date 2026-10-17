/**
 * QUIZRPG — MongoDB seeder (plain Node, no build step needed).
 *
 * Usage:
 *   npm run seed          (uses MONGODB_URI from .env)
 *   MONGODB_URI=... node scripts/seed.mjs
 *
 * Creates demo accounts (admin/admin123, hero/hero123) and 45 starter
 * questions across Mathematics / Science / History / English / Programming.
 * Safe to re-run: existing users are kept, global questions are only
 * inserted when the global bank is empty-ish.
 */
import mongoose from "mongoose";
import crypto from "node:crypto";
import { pathToFileURL } from "node:url";

/* ---------- minimal schemas (mirrors src/lib/models.ts) ---------- */

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true },
    displayName: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "PLAYER"], default: "PLAYER" },
    xp: { type: Number, default: 0, min: 0 },
    battlesWon: { type: Number, default: 0, min: 0 },
    battlesLost: { type: Number, default: 0, min: 0 },
    bestScore: { type: Number, default: 0, min: 0 },
    bestStreak: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true },
);

const questionSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true },
    difficulty: { type: String, enum: ["EASY", "MEDIUM", "HARD"], required: true },
    text: { type: String, required: true },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 3 },
    explanation: { type: String, default: "" },
    ownerId: { type: String, default: null },
  },
  { timestamps: true },
);

const User = mongoose.models.User ?? mongoose.model("User", userSchema);
const Question = mongoose.models.Question ?? mongoose.model("Question", questionSchema);

/* ---------- same scrypt format as src/lib/auth.ts ---------- */

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/* ---------- 45 starter questions ---------- */

const SEED_QUESTIONS = [
  // ---------------- MATHEMATICS ----------------
  { subject: "Mathematics", difficulty: "EASY", text: "What is 7 × 8?", options: ["54", "56", "48", "64"], correctIndex: 1, explanation: "7 × 8 = 56." },
  { subject: "Mathematics", difficulty: "EASY", text: "What is the value of 15 + 27?", options: ["32", "42", "41", "43"], correctIndex: 1, explanation: "15 + 27 = 42." },
  { subject: "Mathematics", difficulty: "EASY", text: "How many sides does a hexagon have?", options: ["5", "7", "6", "8"], correctIndex: 2, explanation: "A hexagon has 6 sides ('hex' = six)." },
  { subject: "Mathematics", difficulty: "MEDIUM", text: "What is the area of a triangle with base 10 and height 6?", options: ["60", "30", "16", "26"], correctIndex: 1, explanation: "Area = ½ × base × height = ½ × 10 × 6 = 30." },
  { subject: "Mathematics", difficulty: "MEDIUM", text: "Solve for x: 3x − 9 = 18", options: ["3", "6", "9", "7"], correctIndex: 2, explanation: "3x = 27, so x = 9." },
  { subject: "Mathematics", difficulty: "MEDIUM", text: "What is 25% of 240?", options: ["48", "50", "60", "70"], correctIndex: 2, explanation: "25% is one quarter: 240 ÷ 4 = 60." },
  { subject: "Mathematics", difficulty: "HARD", text: "What is the derivative of x³?", options: ["3x²", "x²", "3x", "x⁴/4"], correctIndex: 0, explanation: "Power rule: d/dx x³ = 3x²." },
  { subject: "Mathematics", difficulty: "HARD", text: "If a fair coin is flipped 3 times, what is the probability of exactly 2 heads?", options: ["1/2", "1/4", "3/8", "2/3"], correctIndex: 2, explanation: "C(3,2)/8 = 3/8." },
  { subject: "Mathematics", difficulty: "HARD", text: "What is the sum of the interior angles of a pentagon?", options: ["360°", "450°", "540°", "720°"], correctIndex: 2, explanation: "(n − 2) × 180° = 3 × 180° = 540°." },

  // ---------------- SCIENCE ----------------
  { subject: "Science", difficulty: "EASY", text: "Which planet is known as the Red Planet?", options: ["Venus", "Mars", "Jupiter", "Mercury"], correctIndex: 1, explanation: "Mars appears red due to iron oxide (rust) on its surface." },
  { subject: "Science", difficulty: "EASY", text: "What gas do plants absorb from the atmosphere for photosynthesis?", options: ["Oxygen", "Nitrogen", "Carbon dioxide", "Hydrogen"], correctIndex: 2, explanation: "Plants take in CO₂ and release oxygen during photosynthesis." },
  { subject: "Science", difficulty: "EASY", text: "What is the chemical symbol for water?", options: ["WO", "H₂O", "OH₂", "HO₂"], correctIndex: 1, explanation: "Water = two hydrogen atoms + one oxygen atom: H₂O." },
  { subject: "Science", difficulty: "MEDIUM", text: "Which organelle is known as the powerhouse of the cell?", options: ["Nucleus", "Ribosome", "Mitochondrion", "Golgi apparatus"], correctIndex: 2, explanation: "Mitochondria produce most of the cell's ATP energy." },
  { subject: "Science", difficulty: "MEDIUM", text: "What is the speed of light in a vacuum (approximately)?", options: ["300,000 km/s", "150,000 km/s", "1,080 km/h", "30,000 km/s"], correctIndex: 0, explanation: "Light travels at about 3 × 10⁸ m/s = 300,000 km/s." },
  { subject: "Science", difficulty: "MEDIUM", text: "Which element has the atomic number 6?", options: ["Oxygen", "Carbon", "Helium", "Neon"], correctIndex: 1, explanation: "Carbon has 6 protons, so its atomic number is 6." },
  { subject: "Science", difficulty: "HARD", text: "In physics, what does Newton's Third Law state?", options: ["F = ma", "Every action has an equal and opposite reaction", "Energy cannot be created or destroyed", "Objects in motion stay in motion"], correctIndex: 1, explanation: "The Third Law: for every action there is an equal and opposite reaction." },
  { subject: "Science", difficulty: "HARD", text: "What is the most abundant gas in Earth's atmosphere?", options: ["Oxygen", "Carbon dioxide", "Argon", "Nitrogen"], correctIndex: 3, explanation: "Nitrogen makes up about 78% of the atmosphere." },
  { subject: "Science", difficulty: "HARD", text: "Which particle carries a negative electric charge?", options: ["Proton", "Neutron", "Electron", "Positron"], correctIndex: 2, explanation: "Electrons are negatively charged; protons positive, neutrons neutral." },

  // ---------------- HISTORY ----------------
  { subject: "History", difficulty: "EASY", text: "In which year did World War II end?", options: ["1943", "1944", "1945", "1946"], correctIndex: 2, explanation: "WWII ended in 1945 with the surrender of Germany and Japan." },
  { subject: "History", difficulty: "EASY", text: "Who was the first President of the United States?", options: ["Thomas Jefferson", "George Washington", "Abraham Lincoln", "John Adams"], correctIndex: 1, explanation: "George Washington served from 1789 to 1797." },
  { subject: "History", difficulty: "EASY", text: "The Great Pyramid of Giza was built in which country?", options: ["Mexico", "Iraq", "Egypt", "Greece"], correctIndex: 2, explanation: "The Great Pyramid is in Giza, Egypt." },
  { subject: "History", difficulty: "MEDIUM", text: "Which empire was ruled by Genghis Khan?", options: ["Roman Empire", "Ottoman Empire", "Mongol Empire", "Persian Empire"], correctIndex: 2, explanation: "Genghis Khan founded and ruled the Mongol Empire." },
  { subject: "History", difficulty: "MEDIUM", text: "The Berlin Wall fell in which year?", options: ["1987", "1989", "1991", "1985"], correctIndex: 1, explanation: "The Berlin Wall fell on November 9, 1989." },
  { subject: "History", difficulty: "MEDIUM", text: "Who is credited with inventing the printing press in Europe?", options: ["Leonardo da Vinci", "Johannes Gutenberg", "Galileo Galilei", "Isaac Newton"], correctIndex: 1, explanation: "Johannes Gutenberg introduced the movable-type press around 1440." },
  { subject: "History", difficulty: "HARD", text: "Which document did King John of England sign in 1215?", options: ["Bill of Rights", "Magna Carta", "Declaration of Independence", "Treaty of Versailles"], correctIndex: 1, explanation: "The Magna Carta limited royal power and was signed in 1215." },
  { subject: "History", difficulty: "HARD", text: "The Hundred Years' War was fought between which two countries?", options: ["France and Spain", "England and France", "England and Spain", "France and Germany"], correctIndex: 1, explanation: "It was a series of conflicts between England and France (1337–1453)." },
  { subject: "History", difficulty: "HARD", text: "Who was the last pharaoh of ancient Egypt?", options: ["Nefertiti", "Hatshepsut", "Cleopatra VII", "Tutankhamun"], correctIndex: 2, explanation: "Cleopatra VII was the last active pharaoh of Ptolemaic Egypt." },

  // ---------------- ENGLISH ----------------
  { subject: "English", difficulty: "EASY", text: "Which word is a synonym of 'happy'?", options: ["Joyful", "Angry", "Tired", "Fearful"], correctIndex: 0, explanation: "'Joyful' means the same as 'happy'." },
  { subject: "English", difficulty: "EASY", text: "What is the plural of 'mouse'?", options: ["Mouses", "Mice", "Mouse", "Mices"], correctIndex: 1, explanation: "The irregular plural of 'mouse' is 'mice'." },
  { subject: "English", difficulty: "EASY", text: "Identify the verb: 'She quickly ran to the store.'", options: ["quickly", "store", "ran", "She"], correctIndex: 2, explanation: "'Ran' is the action word — the verb." },
  { subject: "English", difficulty: "MEDIUM", text: "What is a metaphor?", options: ["A comparison using 'like' or 'as'", "A direct comparison without 'like' or 'as'", "An exaggeration for effect", "A question not meant to be answered"], correctIndex: 1, explanation: "A metaphor says one thing IS another; similes use 'like' or 'as'." },
  { subject: "English", difficulty: "MEDIUM", text: "Which sentence is grammatically correct?", options: ["Their going to the park.", "They're going to the park.", "There going to the park.", "Theyre going to the park."], correctIndex: 1, explanation: "'They're' is the contraction of 'they are'." },
  { subject: "English", difficulty: "MEDIUM", text: "What is the meaning of the prefix 'anti-'?", options: ["Before", "Against", "After", "Again"], correctIndex: 1, explanation: "'Anti-' means against, as in 'anti-hero'." },
  { subject: "English", difficulty: "HARD", text: "Which literary device is used in: 'The wind whispered through the trees'?", options: ["Hyperbole", "Personification", "Alliteration", "Onomatopoeia"], correctIndex: 1, explanation: "Personification gives human traits (whispering) to non-human things." },
  { subject: "English", difficulty: "HARD", text: "What does the word 'ephemeral' mean?", options: ["Lasting forever", "Extremely large", "Short-lived", "Deeply hidden"], correctIndex: 2, explanation: "'Ephemeral' describes something that lasts a very short time." },
  { subject: "English", difficulty: "HARD", text: "In literature, an unreliable narrator is one who...", options: ["Speaks multiple languages", "Cannot be fully trusted to tell the story accurately", "Narrates in third person", "Writes in verse"], correctIndex: 1, explanation: "An unreliable narrator's credibility is compromised, twisting our view of events." },

  // ---------------- PROGRAMMING ----------------
  { subject: "Programming", difficulty: "EASY", text: "What does 'HTML' stand for?", options: ["HyperText Markup Language", "HighText Machine Language", "HyperTool Multi Language", "HomeText Markup Layout"], correctIndex: 0, explanation: "HTML = HyperText Markup Language, the structure of the web." },
  { subject: "Programming", difficulty: "EASY", text: "Which keyword declares a variable that cannot be reassigned in JavaScript?", options: ["var", "let", "const", "static"], correctIndex: 2, explanation: "'const' creates a binding that cannot be reassigned." },
  { subject: "Programming", difficulty: "EASY", text: "What symbol starts a single-line comment in JavaScript?", options: ["<!--", "//", "##", "**"], correctIndex: 1, explanation: "// begins a single-line comment in JavaScript." },
  { subject: "Programming", difficulty: "MEDIUM", text: "What does 'CSS' stand for?", options: ["Creative Style Sheets", "Cascading Style Sheets", "Computer Style Sheets", "Colorful Style Syntax"], correctIndex: 1, explanation: "CSS = Cascading Style Sheets." },
  { subject: "Programming", difficulty: "MEDIUM", text: "In programming, what is a 'loop'?", options: ["A type of error", "A structure that repeats instructions", "A variable name", "A comment format"], correctIndex: 1, explanation: "Loops repeat a block of code until a condition is met." },
  { subject: "Programming", difficulty: "MEDIUM", text: "Which data structure works on First-In-First-Out (FIFO) principle?", options: ["Stack", "Queue", "Tree", "Graph"], correctIndex: 1, explanation: "A queue processes elements in the order they arrived (FIFO)." },
  { subject: "Programming", difficulty: "HARD", text: "What is the time complexity of binary search on a sorted array?", options: ["O(n)", "O(n log n)", "O(log n)", "O(1)"], correctIndex: 2, explanation: "Binary search halves the search space each step: O(log n)." },
  { subject: "Programming", difficulty: "HARD", text: "In object-oriented programming, what is 'inheritance'?", options: ["Copying files between folders", "A class deriving properties from another class", "Sorting objects by size", "Deleting unused variables"], correctIndex: 1, explanation: "Inheritance lets a child class reuse and extend a parent class's behavior." },
  { subject: "Programming", difficulty: "HARD", text: "What does the 'M' stand for in the MVC architecture pattern?", options: ["Markup", "Model", "Method", "Module"], correctIndex: 1, explanation: "MVC = Model, View, Controller — the Model manages data and logic." },
];

/* ---------- seeding ---------- */

export async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env or pass it inline (see README).");
  }
  await mongoose.connect(uri);
  console.log(`Seeding QUIZRPG database at ${uri.replace(/\/\/.*@/, "//***@")}...`);

  // --- admin account ---
  const adminResult = await User.updateOne(
    { username: "admin" },
    {
      $setOnInsert: {
        username: "admin",
        displayName: "Game Master",
        passwordHash: hashPassword("admin123"),
        role: "ADMIN",
      },
    },
    { upsert: true },
  );
  const admin = await User.findOne({ username: "admin" }).lean();
  console.log(`Admin ready: admin / admin123 (id=${admin._id}, ${adminResult.upsertedId ? "created" : "already existed"})`);

  // --- demo player ---
  await User.updateOne(
    { username: "hero" },
    {
      $setOnInsert: {
        username: "hero",
        displayName: "Test Hero",
        passwordHash: hashPassword("hero123"),
        role: "PLAYER",
      },
    },
    { upsert: true },
  );
  console.log("Demo player ready: hero / hero123");

  // --- questions (skip if the global bank is already populated) ---
  const count = await Question.countDocuments({ ownerId: null });
  if (count >= SEED_QUESTIONS.length) {
    console.log(`Global question bank already seeded (${count} questions). Skipping.`);
  } else {
    await Question.deleteMany({ ownerId: null });
    await Question.insertMany(SEED_QUESTIONS.map((q) => ({ ...q, ownerId: null })));
    console.log(`Seeded ${SEED_QUESTIONS.length} questions.`);
  }

  const totalUsers = await User.countDocuments();
  const totalQuestions = await Question.countDocuments();
  console.log(`Seed complete. Users: ${totalUsers}, Questions: ${totalQuestions}.`);
}

/* ---------- CLI entry ---------- */

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seed()
    .then(() => mongoose.disconnect())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
