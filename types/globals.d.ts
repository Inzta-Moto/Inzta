// Memberitahu TypeScript bahwa mengimpor file CSS itu diperbolehkan
declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}
