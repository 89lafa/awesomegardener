import AdminDataCleanup from './pages/AdminDataCleanup';
import AdminDataImport from './pages/AdminDataImport';
import BrowseGardens from './pages/BrowseGardens';
import Calendar from './pages/Calendar';
import CalendarPlanner from './pages/CalendarPlanner';
import CalendarTasks from './pages/CalendarTasks';
import Community from './pages/Community';
import CommunityBoard from './pages/CommunityBoard';
import CompanionPlanner from './pages/CompanionPlanner';
import Dashboard from './pages/Dashboard';
import EditVariety from './pages/EditVariety';
import EditorReviewQueue from './pages/EditorReviewQueue';
import FeatureRequests from './pages/FeatureRequests';
import ForumAdmin from './pages/ForumAdmin';
import ForumCategory from './pages/ForumCategory';
import ForumTopic from './pages/ForumTopic';
import GardenBuilder from './pages/GardenBuilder';
import GardenDiary from './pages/GardenDiary';
import GardenPlanting from './pages/GardenPlanting';
import Gardens from './pages/Gardens';
import GrowLists from './pages/GrowLists';
import GrowingProfile from './pages/GrowingProfile';
import HarvestLog from './pages/HarvestLog';
import IssuesLog from './pages/IssuesLog';
import Landing from './pages/Landing';
import MyGarden from './pages/MyGarden';
import MyPlants from './pages/MyPlants';
import Onboarding from './pages/Onboarding';
import PlantCatalog from './pages/PlantCatalog';
import PlantCatalogBrowse from './pages/PlantCatalogBrowse';
import PlantCatalogDetail from './pages/PlantCatalogDetail';
import PlantCatalogV2 from './pages/PlantCatalogV2';
import PlotBuilder from './pages/PlotBuilder';
import PublicGarden from './pages/PublicGarden';
import SeedInventory from './pages/SeedInventory';
import SeedStash from './pages/SeedStash';
import SeedStashDetail from './pages/SeedStashDetail';
import Settings from './pages/Settings';
import VarietyReviewQueue from './pages/VarietyReviewQueue';
import EditPlantType from './pages/EditPlantType';
import __Layout from './Layout.jsx';


export const PAGES = {
    "AdminDataCleanup": AdminDataCleanup,
    "AdminDataImport": AdminDataImport,
    "BrowseGardens": BrowseGardens,
    "Calendar": Calendar,
    "CalendarPlanner": CalendarPlanner,
    "CalendarTasks": CalendarTasks,
    "Community": Community,
    "CommunityBoard": CommunityBoard,
    "CompanionPlanner": CompanionPlanner,
    "Dashboard": Dashboard,
    "EditVariety": EditVariety,
    "EditorReviewQueue": EditorReviewQueue,
    "FeatureRequests": FeatureRequests,
    "ForumAdmin": ForumAdmin,
    "ForumCategory": ForumCategory,
    "ForumTopic": ForumTopic,
    "GardenBuilder": GardenBuilder,
    "GardenDiary": GardenDiary,
    "GardenPlanting": GardenPlanting,
    "Gardens": Gardens,
    "GrowLists": GrowLists,
    "GrowingProfile": GrowingProfile,
    "HarvestLog": HarvestLog,
    "IssuesLog": IssuesLog,
    "Landing": Landing,
    "MyGarden": MyGarden,
    "MyPlants": MyPlants,
    "Onboarding": Onboarding,
    "PlantCatalog": PlantCatalog,
    "PlantCatalogBrowse": PlantCatalogBrowse,
    "PlantCatalogDetail": PlantCatalogDetail,
    "PlantCatalogV2": PlantCatalogV2,
    "PlotBuilder": PlotBuilder,
    "PublicGarden": PublicGarden,
    "SeedInventory": SeedInventory,
    "SeedStash": SeedStash,
    "SeedStashDetail": SeedStashDetail,
    "Settings": Settings,
    "VarietyReviewQueue": VarietyReviewQueue,
    "EditPlantType": EditPlantType,
}

export const pagesConfig = {
    mainPage: "Landing",
    Pages: PAGES,
    Layout: __Layout,
};