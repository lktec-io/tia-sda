import { Link } from 'react-router-dom';
import BrandLogo from './BrandLogo';
import { InstagramIcon, MapPinIcon, ShopIcon, YouTubeIcon } from './Icons';
import { location, shopifyStoreUrl, socialChannels } from '../data/siteContent';

const CHANNEL_ICONS = {
  instagram: InstagramIcon,
  youtube: YouTubeIcon
};

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer" id="visit">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <div className="footer-brand-top">
              <BrandLogo />
              <div>
                <strong>TUCASA TIA Mbeya</strong>
                <span>Seventh-day Adventist Student Church</span>
              </div>
            </div>
            <p>
              Tanzania Universities and Colleges Adventist Students Association at the Tanzania
              Institute of Accountancy, Mbeya. A home for worship, fellowship and service on campus.
            </p>
          </div>

          <div className="footer-col">
            <h4>Explore</h4>
            <ul>
              <li><a href="#announcements">Announcements</a></li>
              <li><a href="#ministries">Choir & Ministries</a></li>
              <li><Link to="/register">Join Fellowship</Link></li>
              <li><Link to="/login">Member Access</Link></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4>Our Channels</h4>
            {socialChannels.map((group) => (
              <div key={group.group} className="footer-social-group">
                <span className="footer-social-title">{group.group}</span>
                <ul className="footer-social">
                  {group.links.map((channel) => {
                    const Icon = CHANNEL_ICONS[channel.platform];
                    return (
                      <li key={channel.id}>
                        <a
                          href={channel.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${group.group} on ${channel.label} (opens in a new tab)`}
                        >
                          <span className="footer-social-icon">{Icon && <Icon width={18} height={18} />}</span>
                          <span>
                            <strong>{channel.label}</strong>
                            <small>{channel.handle}</small>
                          </span>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
            {shopifyStoreUrl && (
              <a className="footer-shop" href={shopifyStoreUrl} target="_blank" rel="noopener noreferrer">
                <ShopIcon width={16} height={16} />
                Official Store
              </a>
            )}
          </div>

          <div className="footer-col footer-directions">
            <h4>Find Us</h4>
            <p className="footer-campus">
              <MapPinIcon width={16} height={16} />
              {location.campus}
            </p>
            <ol>
              {location.directions.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <a className="footer-map-link" href={location.mapUrl} target="_blank" rel="noopener noreferrer">
              Open in Google Maps →
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {year} TUCASA TIA Mbeya. All rights reserved.</span>
          <span>Worship · Fellowship · Service</span>
        </div>
      </div>
    </footer>
  );
}
