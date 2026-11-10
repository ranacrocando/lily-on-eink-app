export interface TransferHelp {
  /** Name of the reader family, e.g. "Kobo". */
  family: string;
  /** Short steps in plain English. */
  steps: string[];
}

const USB_STEPS = [
  'Connect the e-reader to your computer with a USB cable.',
  'Copy the PDF onto the e-reader. It appears as a drive or a folder.',
  'Eject the e-reader on your computer, then unplug the cable.',
];

const FAMILIES: { prefix: string; help: TransferHelp }[] = [
  {
    prefix: 'kobo-',
    help: {
      family: 'Kobo',
      steps: [
        'Connect your Kobo to your computer with a USB cable and tap "Connect" on the reader if it asks.',
        'The Kobo appears as a drive. Copy the PDF onto it. Any folder is fine.',
        'Eject the drive on your computer, then unplug the cable. The PDF shows up in your library after a moment.',
      ],
    },
  },
  {
    prefix: 'kindle-',
    help: {
      family: 'Kindle',
      steps: [
        'Connect your Kindle to your computer with a USB cable.',
        'Open the Kindle drive and copy the PDF into its "documents" folder.',
        'Eject the drive, then unplug the cable.',
        'Please do not use "Send to Kindle" for these PDFs: it converts them and often ruins the layout. The USB cable keeps every page exactly as it is.',
      ],
    },
  },
  {
    prefix: 'pocketbook-',
    help: {
      family: 'PocketBook',
      steps: [
        'With a USB cable: connect the PocketBook to your computer and copy the PDF onto the drive that appears. Then eject it.',
        'Without a cable: email the PDF to your personal Send-to-PocketBook address. It arrives on the reader when the reader is online.',
      ],
    },
  },
  {
    prefix: 'remarkable-',
    help: {
      family: 'reMarkable',
      steps: [
        'Easiest: open the reMarkable app on your computer or phone and add the PDF there. It syncs to your tablet.',
        'Or use a USB cable: switch on the "USB web interface" in the storage settings of the tablet, open the address it shows in your browser and drop the PDF there.',
      ],
    },
  },
  {
    prefix: 'boox-',
    help: { family: 'Boox', steps: USB_STEPS },
  },
];

/** How to move a PDF to the e-reader with the given device id (a preset id or "custom"). */
export function transferHelp(deviceId: string): TransferHelp {
  const found = FAMILIES.find((f) => deviceId.startsWith(f.prefix));
  return found?.help ?? { family: 'Other e-readers', steps: USB_STEPS };
}

/** Shows the steps for a device inside `body`. */
export function renderHelp(body: HTMLElement, deviceId: string): void {
  const { family, steps } = transferHelp(deviceId);
  const heading = document.createElement('h3');
  heading.textContent = family;
  const list = document.createElement('ol');
  for (const step of steps) {
    const li = document.createElement('li');
    li.textContent = step;
    list.append(li);
  }
  body.replaceChildren(heading, list);
}
