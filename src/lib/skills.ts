export const ACTIVITIES = [
  { id: "drawing", name: "Drawing", emoji: "🖍️", color: "bg-coral", desc: "Draw a picture from a fun idea." },
  { id: "story", name: "Story Writing", emoji: "📝", color: "bg-sky", desc: "Write your own short story." },
  { id: "poem", name: "Poem Writing", emoji: "🎵", color: "bg-sun", desc: "Write a little poem." },
  { id: "maths", name: "Mathematics Improvement", emoji: "🧮", color: "bg-leaf", desc: "Quick maths challenges." },
  { id: "english", name: "English Improvement", emoji: "🔤", color: "bg-sky", desc: "Spelling, words and grammar." },
  { id: "malayalam", name: "Malayalam Improvement", emoji: "🪔", color: "bg-coral", desc: "അക്ഷരങ്ങളും വാക്കുകളും." },
] as const;

export type ActivityId = (typeof ACTIVITIES)[number]["id"];
export const activityById = (id: string) => ACTIVITIES.find((a) => a.id === id);
