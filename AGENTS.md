<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- AI calls go to Google Gemini directly via the user's GEMINI_API_KEY in src/lib/ai.functions.ts (user chose own key over built-in AI).
- Student login is username-only: username maps to a synthetic email `<username>@students.vidyakalari.app`, auto-confirm on (spec forbids email).
- Topic games live in the Learn/Game/Quiz topic view; the old game URL redirects there, and game modes are Alphabet circle, Froggy Jumps and Aster space quiz with Gemini-generated topic content so navigation and progress stay unified.
- Gemini returns validated game data and original character appearance parameters, never executable code or markup; trusted renderers provide gameplay, cartoons, and optional local sound effects for safe child-friendly play.
- Automatic topic-game generation uses a user/topic-scoped query with explicit replay generations so completed requests remain observable across component lifecycle changes and tab switches.
