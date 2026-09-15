import { themeMode } from './features/theme-mode';
import { nav, langMenu } from './features/header-widgets';
import { backToTop } from './features/back-to-top';
import { homeCoverScroll } from './features/home-cover-scroll';
import { reveal } from './features/reveal';
import { tocManager } from './features/toc-manager';

themeMode.init();
nav.init();
langMenu.init();
backToTop.init();
homeCoverScroll.init();
reveal.init();
tocManager.init();
