import React from 'react';

const Navbar = ({ NAV_CATEGORIES, activeDropdown, setActiveDropdown, activeTab, setActiveTab }) => {
  return (
    <nav className="navbar mb-0">
      {Object.entries(NAV_CATEGORIES).map(([categoryKey, category]) => (
        <div
          key={categoryKey}
          className={`nav-item ${activeDropdown === categoryKey ? 'active-category' : ''}`}
          onMouseEnter={() => category.subTabs && setActiveDropdown(categoryKey)}
          onMouseLeave={() => setActiveDropdown(null)}
          onClick={() => {
            if (!category.subTabs) {
              setActiveTab(category.tab);
              setActiveDropdown(null);
            }
          }}
        >
          {category.label}
          {category.subTabs && (
            <div className={`dropdown-content ${activeDropdown === categoryKey ? 'active' : ''}`}>
              {category.subTabs.map((subTab) => (
                <a
                  key={subTab.tab}
                  href="#"
                  className={`dropdown-item ${activeTab === subTab.tab ? 'active-tab' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveTab(subTab.tab);
                    setActiveDropdown(null);
                  }}
                >
                  {subTab.label}
                </a>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
};

export default Navbar;
