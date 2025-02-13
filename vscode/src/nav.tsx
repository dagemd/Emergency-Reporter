import './index.css';
import logo from './assets/mv-logo-white.png';

function handleSearchSubmit(){
    // Enter key
    // if(e.which == 13){
    //     window.location.href = `https://metrovancouver.org/search/Pages/results.aspx?k=${e.target.value}`
    // }
}

export default function Nav() {
    return (
        <ul className="nav">
            <li key={0}><a className="logo-link" href="https://metrovancouver.org/"><img src={logo} alt="logo" /></a></li>
            <li key={1} className="search-container">
                <input className="search-bar" onKeyDown={handleSearchSubmit} type="text" placeholder="Search..." />
            </li>
        </ul>
    )
}