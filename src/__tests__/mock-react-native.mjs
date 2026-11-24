export const Platform = {
  OS: 'android',
  select: (obj) => (obj && 'android' in obj ? obj.android : obj?.default),
};
export default { Platform };
