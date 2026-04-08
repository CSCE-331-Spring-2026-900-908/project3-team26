import { useEffect, useMemo, useRef, useState } from 'react';

const STORAGE_KEY = 'bubble-tea-accessibility';
const GOOGLE_SCRIPT_ID = 'google-translate-script';
const GOOGLE_HOST_ID = 'google_translate_element';
const LENS_WIDTH = 240;
const LENS_HEIGHT = 180;
const LENS_VERTICAL_OFFSET = 44;