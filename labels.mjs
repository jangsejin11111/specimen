// Label identity belongs to a classification, not to a mine or moving insect.
export const GENERA = ['Carabus', 'Silpha', 'Tenebrio', 'Amara', 'Harpalus'];
export class LabelData {
  constructor(random = Math.random) { this.random = random; this.reset(); }
  reset() { this.serial = 0; }
  create() {
    const genus = GENERA[Math.floor(this.random() * GENERA.length)];
    const number = String(++this.serial).padStart(2, '0');
    return Object.freeze({ genus, number, name: `${genus}-${number}` });
  }
}
