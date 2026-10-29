// Button label split into letters for the hover bounce (SiteMotion onPointer, after Sehan's BookMate buttons). React
// renders the letters itself, so a label that changes (the Garasi button follows the chosen motor) re-renders cleanly
// and GSAP only ever touches their transforms. Screen readers read the plain label; word gaps come from CSS margins
// because whitespace between inline-blocks of a flex label would collapse.
export default function Bounce({ text }: { text: string }) {
  const words = text.split(' ');
  return (
    <>
      <span className="iz-sr">{text}</span>
      <span className="iz-bounce" aria-hidden="true">
        {words.map((word, w) => (
          <span className="iz-bounce__w" key={`${word}-${w}`}>
            {Array.from(word).map((char, c) => (
              <span className="iz-bounce__c" key={c}>
                {char}
              </span>
            ))}
          </span>
        ))}
      </span>
    </>
  );
}
