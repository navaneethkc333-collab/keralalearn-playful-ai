export type SubjectId = "english" | "malayalam" | "maths" | "evs";

export const SUBJECTS: { id: SubjectId; name: string; ml: string; emoji: string; color: string }[] = [
  { id: "english", name: "English", ml: "ഇംഗ്ലീഷ്", emoji: "📖", color: "bg-sky" },
  { id: "malayalam", name: "Malayalam", ml: "മലയാളം", emoji: "🪔", color: "bg-coral" },
  { id: "maths", name: "Mathematics", ml: "ഗണിതം", emoji: "🔢", color: "bg-sun" },
  { id: "evs", name: "Environmental Studies", ml: "പരിസരപഠനം", emoji: "🌿", color: "bg-leaf" },
];

// Topic outlines aligned to the Kerala State primary syllabus themes.
export const TOPICS: Record<number, Record<SubjectId, string[]>> = {
  1: {
    english: ["Alphabet and letter sounds", "Colours around us", "My family words", "Animals and their sounds", "Simple greetings"],
    malayalam: ["സ്വരാക്ഷരങ്ങൾ (Vowels)", "വ്യഞ്ജനാക്ഷരങ്ങൾ (Consonants)", "പൂക്കളും പഴങ്ങളും", "എന്റെ വീട്", "കുട്ടിപ്പാട്ടുകൾ"],
    maths: ["Numbers 1 to 20", "Counting objects", "Big and small", "Shapes around us", "Simple addition"],
    evs: ["My body", "My family", "Plants around us", "Animals around us", "Food we eat"],
  },
  2: {
    english: ["Naming words (nouns)", "Action words", "Days of the week", "Rhymes and rhyming words", "Opposites"],
    malayalam: ["ചിഹ്നങ്ങൾ", "കൂട്ടക്ഷരങ്ങൾ", "ഓണം", "കഥ കേൾക്കാം", "പക്ഷികൾ"],
    maths: ["Numbers up to 100", "Addition with carrying", "Subtraction", "Measuring length", "Time and clock"],
    evs: ["Water and its uses", "Houses and shelters", "Birds of Kerala", "Keeping clean", "Seasons"],
  },
  3: {
    english: ["Describing words (adjectives)", "Singular and plural", "Reading short stories", "Using a, an, the", "Writing sentences"],
    malayalam: ["വാക്യരചന", "പര്യായപദങ്ങൾ", "കേരളത്തിന്റെ ഉത്സവങ്ങൾ", "കവിത ആസ്വാദനം", "കത്തെഴുത്ത്"],
    maths: ["Numbers up to 1000", "Multiplication tables", "Simple division", "Money and shopping", "Fractions: half and quarter"],
    evs: ["Rivers of Kerala", "Farming and crops", "Our helpers", "Transport", "Air around us"],
  },
  4: {
    english: ["Tenses: past, present, future", "Punctuation", "Comprehension passages", "Pronouns", "Story writing"],
    malayalam: ["വിപരീതപദങ്ങൾ", "നാടൻകലകൾ", "പ്രകൃതി സംരക്ഷണം", "ഉപന്യാസം", "പഴഞ്ചൊല്ലുകൾ"],
    maths: ["Large numbers", "Multiplication and division", "Fractions", "Perimeter and area", "Data and graphs"],
    evs: ["Kerala's geography", "Forests and wildlife", "Food and health", "Soil", "Energy and its sources"],
  },
};

export function subjectById(id: string) {
  return SUBJECTS.find((s) => s.id === id);
}
