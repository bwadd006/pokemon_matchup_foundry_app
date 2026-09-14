import { createRoot } from 'react-dom/client';

import { Application } from './app/application';
import './styles/global.css';
import './styles/types.css';
import './styles/type_chart.css';
import './styles/team_builder.css';
import './styles/team_matchup.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing application root.');

createRoot(root).render(<Application />);
