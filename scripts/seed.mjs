/**
 * QUIZRPG database seeder — idempotent.
 * Creates staff accounts (superadmin / admin) and an official starter
 * question bank across subjects and all five difficulties.
 */
import mongoose from "mongoose";
import { randomBytes, scryptSync } from "node:crypto";

/* ---------- password hashing (matches src/lib/auth.ts) ---------- */
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

/* ---------- minimal schemas (standalone, no imports needed) ---------- */
const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, minlength: 3, maxlength: 20 },
    displayName: { type: String, default: "", maxlength: 30 },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "SUPER_ADMIN", "PLAYER"], default: "PLAYER" },
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
    subject: { type: String, required: true, maxlength: 40 },
    difficulty: { type: String, enum: ["EASY", "MEDIUM", "HARD", "EXPERT", "MASTER"], required: true },
    text: { type: String, required: true, maxlength: 500 },
    options: { type: [String], required: true },
    correctIndex: { type: Number, required: true, min: 0, max: 9 },
    explanation: { type: String, default: "", maxlength: 500 },
    ownerId: { type: String, default: null },
    status: { type: String, enum: ["OFFICIAL", "CUSTOM", "PENDING", "REJECTED"], default: "CUSTOM" },
    reviewNote: { type: String, default: "", maxlength: 300 },
  },
  { timestamps: true },
);

const User = mongoose.models.User ?? mongoose.model("User", userSchema);
const Question = mongoose.models.Question ?? mongoose.model("Question", questionSchema);

/* ---------- official starter bank ---------- */
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
  { subject: "Mathematics", difficulty: "EXPERT", text: "What is the value of e (Euler's number) to three decimal places?", options: ["2.718", "3.142", "1.618", "2.302"], correctIndex: 0, explanation: "e ≈ 2.718, the base of natural logarithms." },
  { subject: "Mathematics", difficulty: "EXPERT", text: "What does the Fundamental Theorem of Calculus connect?", options: ["Derivatives and integrals", "Algebra and geometry", "Prime numbers and factoring", "Limits and series"], correctIndex: 0, explanation: "It shows differentiation and integration are inverse operations." },
  { subject: "Mathematics", difficulty: "EXPERT", text: "What is the imaginary unit i squared?", options: ["1", "−1", "i", "−i"], correctIndex: 1, explanation: "i² = −1 by definition of imaginary numbers." },
  { subject: "Mathematics", difficulty: "MASTER", text: "What is the general solution of dy/dx = ky (k constant)?", options: ["y = Ce^(kx)", "y = Cx^k", "y = kx + C", "y = ln(kx) + C"], correctIndex: 0, explanation: "Exponential growth: y = Ce^(kx) solves the separable ODE." },
  { subject: "Mathematics", difficulty: "MASTER", text: "What is the determinant of a 2×2 matrix [[a, b], [c, d]]?", options: ["ad − bc", "ab − cd", "a + d", "ac + bd"], correctIndex: 0, explanation: "det = ad − bc for 2×2 matrices." },
  { subject: "Mathematics", difficulty: "MASTER", text: "What does it mean for a matrix to be singular?", options: ["It has determinant 0 (not invertible)", "It is symmetric", "It has 1 row", "All entries are 1"], correctIndex: 0, explanation: "A singular matrix has zero determinant and no inverse." },

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
  { subject: "Science", difficulty: "EXPERT", text: "What is the energy molecule that cells use for fuel?", options: ["ATP", "DNA", "RNA", "Glucose"], correctIndex: 0, explanation: "ATP (adenosine triphosphate) is the cell's energy currency." },
  { subject: "Science", difficulty: "EXPERT", text: "In genetics, what does DNA transcription produce?", options: ["mRNA", "Protein", "Lipids", "Carbohydrates"], correctIndex: 0, explanation: "Transcription copies DNA into messenger RNA (mRNA)." },
  { subject: "Science", difficulty: "EXPERT", text: "What is the pH of a neutral solution at 25°C?", options: ["7", "0", "14", "1"], correctIndex: 0, explanation: "Neutral pH is exactly 7 (equal H⁺ and OH⁻ concentrations)." },
  { subject: "Science", difficulty: "MASTER", text: "Which law states entropy of an isolated system never decreases?", options: ["Second Law of Thermodynamics", "First Law of Thermodynamics", "Newton's First Law", "Ohm's Law"], correctIndex: 0, explanation: "The Second Law: total entropy always increases in isolated systems." },
  { subject: "Science", difficulty: "MASTER", text: "What particle mediates the electromagnetic force?", options: ["Photon", "Gluon", "Neutrino", "Graviton"], correctIndex: 0, explanation: "Photons are the force carriers of electromagnetism." },
  { subject: "Science", difficulty: "MASTER", text: "What is the process by which stars produce energy?", options: ["Nuclear fusion", "Nuclear fission", "Chemical combustion", "Radioactive decay"], correctIndex: 0, explanation: "Stars fuse hydrogen into helium, releasing enormous energy." },

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
  { subject: "History", difficulty: "EXPERT", text: "What year did the Industrial Revolution generally begin in Britain?", options: ["Around 1760", "Around 1600", "Around 1850", "Around 1900"], correctIndex: 0, explanation: "The Industrial Revolution took off in Britain around 1760." },
  { subject: "History", difficulty: "EXPERT", text: "Who was the Spanish conquistador that conquered the Aztec Empire?", options: ["Hernán Cortés", "Francisco Pizarro", "Vasco da Gama", "Ferdinand Magellan"], correctIndex: 0, explanation: "Cortés toppled the Aztec Empire (1519–1521); Pizarro conquered the Inca." },
  { subject: "History", difficulty: "EXPERT", text: "The Treaty of Westphalia (1648) ended which war?", options: ["Thirty Years' War", "Hundred Years' War", "War of the Roses", "Seven Years' War"], correctIndex: 0, explanation: "It ended the Thirty Years' War and shaped modern state sovereignty." },
  { subject: "History", difficulty: "MASTER", text: "Which ancient civilization developed the cuneiform writing system?", options: ["Sumerians", "Egyptians", "Phoenicians", "Minoans"], correctIndex: 0, explanation: "Sumerians of Mesopotamia created cuneiform around 3200 BCE." },
  { subject: "History", difficulty: "MASTER", text: "What combination of pressures most directly caused the fall of the Western Roman Empire in 476 CE?", options: ["Invasions, economic decline and political instability", "A single volcanic eruption", "The rise of China", "The Black Death alone"], correctIndex: 0, explanation: "Multiple pressures — barbarian invasions, economic crisis, political decay — ended the Western Empire." },
  { subject: "History", difficulty: "MASTER", text: "Which event started World War I?", options: ["Assassination of Archduke Franz Ferdinand", "Bombing of Pearl Harbor", "Invasion of Poland", "Storming of the Bastille"], correctIndex: 0, explanation: "The June 1914 assassination in Sarajevo triggered the war." },

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
  { subject: "English", difficulty: "EXPERT", text: "What is a malapropism?", options: ["The mistaken use of a word in place of a similar-sounding one", "A repeated phrase", "A rhyme scheme", "A type of stanza"], correctIndex: 0, explanation: "A malapropism swaps a word for a similar-sounding wrong one." },
  { subject: "English", difficulty: "EXPERT", text: "Which best describes 'in medias res'?", options: ["A story that begins in the middle of the action", "A story told in letters", "A moral tale", "A poem of 14 lines"], correctIndex: 0, explanation: "'In medias res' = into the middle of things — starting mid-action." },
  { subject: "English", difficulty: "EXPERT", text: "What is the meaning of the Greek root 'chron'?", options: ["Time", "Sound", "Light", "Life"], correctIndex: 0, explanation: "'Chron' means time — as in chronology and chronicle." },
  { subject: "English", difficulty: "MASTER", text: "Which describes the rhythm of iambic pentameter?", options: ["Five unstressed-stressed pairs per line", "Three stressed syllables per line", "All lines rhyme", "No set stress pattern"], correctIndex: 0, explanation: "Iambic pentameter = 5 iambs: unstressed–stressed ×5 (Shakespeare's meter)." },
  { subject: "English", difficulty: "MASTER", text: "What narrative technique streams a character's unfiltered thoughts?", options: ["Stream of consciousness", "Epistolary narration", "Frame narrative", "Second-person narration"], correctIndex: 0, explanation: "Stream of consciousness mimics the flow of raw thought (Joyce, Woolf)." },
  { subject: "English", difficulty: "MASTER", text: "Who wrote the modernist epic 'Ulysses'?", options: ["James Joyce", "T.S. Eliot", "Virginia Woolf", "Ernest Hemingway"], correctIndex: 0, explanation: "James Joyce's 'Ulysses' (1922) is the landmark modernist novel." },

  // ---------------- PROGRAMMING ----------------
  { subject: "Programming", difficulty: "EASY", text: "What does 'HTML' stand for?", options: ["HyperText Markup Language", "HighText Machine Language", "HyperTool Multi Language", "HomeText Markup Layout"], correctIndex: 0, explanation: "HTML = HyperText Markup Language, the structure of the web." },
  { subject: "Programming", difficulty: "EASY", text: "Which keyword declares a variable that cannot be reassigned in JavaScript?", options: ["var", "let", "const", "static"], correctIndex: 2, explanation: "'const' creates a binding that cannot be reassigned." },
  { subject: "Programming", difficulty: "EASY", text: "What symbol starts a single-line comment in JavaScript?", options: ["<!--", "//", "##", "**"], correctIndex: 1, explanation: "// begins a single-line comment in JavaScript." },
  { subject: "Programming", difficulty: "MEDIUM", text: "What does 'CSS' stand for?", options: ["Creative Style Sheets", "Cascading Style Sheets", "Computer Style Sheets", "Colorful Style Syntax"], correctIndex: 1, explanation: "CSS = Cascading Style Sheets." },
  { subject: "Programming", difficulty: "MEDIUM", text: "In programming, what is a 'loop'?", options: ["A type of error", "A structure that repeats instructions", "A variable name", "A comment format"], correctIndex: 1, explanation: "Loops repeat a block of code until a condition is met." },
  { subject: "Programming", difficulty: "MEDIUM", text: "Which data structure works on First-In-First-Out (FIFO) principle?", options: ["Stack", "Queue", "Tree", "Graph"], correctIndex: 1, explanation: "A queue processes elements in the order they arrived (FIFO)." },
  { subject: "Programming", difficulty: "HARD", text: "What is the time complexity of binary search on a sorted array?", options: ["O(n)", "O(n log n)", "O(log n)", "O(1)"], correctIndex: 2, explanation: "Binary search halves the search space each step: O(log n)." },
  { subject: "Programming", difficulty: "HARD", text: "In SQL, which clause filters rows BEFORE grouping?", options: ["WHERE", "HAVING", "ORDER BY", "LIMIT"], correctIndex: 0, explanation: "WHERE filters individual rows; HAVING filters after GROUP BY." },
  { subject: "Programming", difficulty: "HARD", text: "What does 'DRY' stand for in software engineering?", options: ["Don't Repeat Yourself", "Do Reuse Yourself", "Data Ready Yield", "Dynamic Runtime Yield"], correctIndex: 0, explanation: "DRY: avoid duplicating logic — write it once, reuse it." },
  { subject: "Programming", difficulty: "EXPERT", text: "In Git, which command creates a new branch and switches to it?", options: ["git checkout -b <name>", "git branch <name>", "git commit -b <name>", "git tag <name>"], correctIndex: 0, explanation: "git checkout -b creates and switches in one step (git switch -c is newer)." },
  { subject: "Programming", difficulty: "EXPERT", text: "What is a 'closure' in JavaScript?", options: ["A function retaining access to its outer scope's variables", "A completed try/catch", "A locked database transaction", "A CSS rule block"], correctIndex: 0, explanation: "Closures capture variables from where the function was defined." },
  { subject: "Programming", difficulty: "EXPERT", text: "What is the HTTP status code for 'Not Found'?", options: ["404", "301", "500", "403"], correctIndex: 0, explanation: "404 = resource not found; 403 = forbidden; 500 = server error." },
  { subject: "Programming", difficulty: "MASTER", text: "Which HTTP method is idempotent and safe (never changes server state)?", options: ["GET", "POST", "PATCH", "DELETE"], correctIndex: 0, explanation: "GET only reads — repeating it never changes anything." },
  { subject: "Programming", difficulty: "MASTER", text: "What is a race condition in concurrent programming?", options: ["When two threads access shared state and the result depends on timing", "A fast database query", "A loop that never ends", "A CSS animation glitch"], correctIndex: 0, explanation: "Race conditions occur when thread interleaving timing changes results." },
  { subject: "Programming", difficulty: "MASTER", text: "What does MongoDB's $lookup aggregation stage do?", options: ["Performs a left outer join to another collection", "Sorts documents", "Deletes fields", "Creates an index"], correctIndex: 0, explanation: "$lookup joins documents from another collection (like a SQL left join)." },
];

/* ---------- seed ---------- */
async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Add it to .env or pass it inline.");
  }
  await mongoose.connect(uri);
  console.log(`Seeding QUIZRPG database at ${uri.replace(/\/\/.*@/, "//***@")}...`);

  // --- super admin account ---
  // $set (not $setOnInsert) so re-running repairs an existing doc that predates the email requirement
  const superResult = await User.updateOne(
    { username: "superadmin" },
    {
      $set: {
        username: "superadmin",
        displayName: "Archmage",
        email: "superadmin@quizrpg.local",
        emailVerified: true,
        passwordHash: hashPassword("Super!Admin1"),
        role: "SUPER_ADMIN",
      },
    },
    { upsert: true },
  );
  const superAdmin = await User.findOne({ username: "superadmin" }).lean();
  console.log(`Super admin ready: superadmin / Super!Admin1 (${superResult.upsertedId ? "created" : "already existed"}, id=${superAdmin._id})`);

  // --- admin account ---
  const adminResult = await User.updateOne(
    { username: "admin" },
    {
      $set: {
        username: "admin",
        displayName: "Game Master",
        email: "admin@quizrpg.local",
        emailVerified: true,
        passwordHash: hashPassword("Game!Master1"),
        role: "ADMIN",
      },
    },
    { upsert: true },
  );
  const admin = await User.findOne({ username: "admin" }).lean();
  console.log(`Admin ready: admin / Game!Master1 (${adminResult.upsertedId ? "created" : "already existed"}, id=${admin._id})`);

  // --- demo player ---
  await User.updateOne(
    { username: "hero" },
    {
      $set: {
        username: "hero",
        displayName: "Test Hero",
        email: "hero@quizrpg.local",
        emailVerified: true,
        passwordHash: hashPassword("Test!Hero1"),
        role: "PLAYER",
      },
    },
    { upsert: true },
  );
  console.log("Demo player ready: hero / Test!Hero1");

  // --- official questions (replace stale official bank only) ---
  const count = await Question.countDocuments({ status: "OFFICIAL" });
  if (count >= SEED_QUESTIONS.length) {
    console.log(`Official question bank already seeded (${count} questions). Skipping.`);
  } else {
    await Question.deleteMany({ status: "OFFICIAL" });
    await Question.insertMany(SEED_QUESTIONS.map((q) => ({ ...q, ownerId: null, status: "OFFICIAL" })));
    console.log(`Seeded ${SEED_QUESTIONS.length} official questions.`);
  }

  const users = await User.countDocuments();
  const questions = await Question.countDocuments();
  console.log(`Seed complete. Users: ${users}, Questions: ${questions}.`);
}

seed()
  .then(() => mongoose.disconnect())
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
    mongoose.disconnect();
  });
