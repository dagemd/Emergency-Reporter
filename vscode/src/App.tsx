import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import Nav from './nav.tsx'
import './index.css'
import { useState, useEffect } from 'react'
import L, { LatLng } from 'leaflet'
import axios from 'axios';
import { isCorrectPassword } from './password.tsx';
import closeIconWhite from './assets/close-icon-white.png'
import addIcon from './assets/cross.png'

type SortableType = {
  makeSortable: (elem: HTMLTableElement) => void;
}

declare global {
  interface Window {
    sorttable: SortableType;
  }
}

enum ReportStatus {
  OPEN = "Open",
  RESOLVED = "Resolved",
}

type PopupProps = {
  children?: React.ReactNode;
}

type ReportData = {
  type: string,
  location: L.LatLng | null,
  reporterName: string,
  reporterPhone: string,
  time: number,
  status: ReportStatus,
  comment?: string,
  image?: string
}

interface ReportDataProps {
  reportState: ReportsState;
}

type ReportsState = {
  reports: ReportData[];
  setReports: React.Dispatch<React.SetStateAction<ReportData[]>>;
  currentReport: ReportData | null;
  setCurrentReport: React.Dispatch<React.SetStateAction<ReportData | null>>;
  reportLocations: ReportData[];
  setReportLocations: React.Dispatch<React.SetStateAction<ReportData[]>>;
  oneTimeReport: ReportData | null;
  setOneTimeReport: React.Dispatch<React.SetStateAction<ReportData | null>>;
}

function isReportsEqual(rep1: ReportData, rep2: ReportData) {
  return rep1.location?.lat == rep2.location?.lat && rep1.location?.lng == rep2.location?.lng;
}

function latLngToString(location: L.LatLng) {
  let promise = new Promise<string>((successFunc, errorFunc) => {
    let cachedValue = localStorage.getItem(`location=${location.lat}, ${location.lng}`);
    if (cachedValue) {
      successFunc(cachedValue);
      return;
    }

    axios.get(`https://nominatim.openstreetmap.org/reverse?lat=${location.lat}&lon=${location.lng}&format=json`, { timeout: 9000 })
      .then(function (response) {
        let stringName = response.data['name'];
        localStorage.set(`location=${location.lat}, ${location.lng}`, stringName);
        successFunc(stringName);
      })
      .catch(function (error) {
        errorFunc(error);
      });
  });

  return promise;
}

function stringToLatLng(strLoc: string): Promise<L.LatLng> {
  let promise = new Promise<L.LatLng>((successFunc, errorFunc) => {
    let cachedValue = localStorage.get(`namedLocation=${strLoc}`);
    if (cachedValue) {
      let splitValue = cachedValue.split(',');
      let latLong = new L.LatLng(+splitValue[0].trim(), +splitValue[1].trim());
      successFunc(latLong);
      return;
    }

    axios.get(`https://nominatim.openstreetmap.org/search?format=json&q=${strLoc}`, { timeout: 9000 })
      .then(function (response) {
        let latLong = new L.LatLng(+response.data[0]['lat'], +response.data[0]['lon']);
        localStorage.set(`namedLocation=${strLoc}`, `${latLong.lat}, ${latLong.lng}`);
        successFunc(latLong);
      })
      .catch(function (error) {
        errorFunc(error);
      });
  });

  return promise;
}

function PopupPane({ children }: PopupProps) {
  return (
    <div className='popup-overlay'>
      {children}
    </div>
  );
}

interface MapPresenterProps extends ReportDataProps {

}

const MapContainerRecenterer = ({ reportState }: ReportDataProps) => {
  const map = useMap();
  useEffect(() => {
    if (reportState.oneTimeReport && reportState.oneTimeReport.location) {
      const rep = reportState.oneTimeReport;
      map.panTo(reportState.oneTimeReport.location);
      reportState.setOneTimeReport(null);
      reportState.setReportLocations(() => {
        const newLocs = [rep];
        return newLocs;
      });
    }
  });
  return null;
};

interface MapMarkerProps extends MapPresenterProps {
  index: number,
  onClick: () => void,
  report: ReportData,
}

function MapMarker({ report, reportState, index, onClick }: MapMarkerProps) {
  const map = useMap();
  const updateLocationsFunc = () => {
    const el = reportState.reportLocations.find(v => isReportsEqual(v, report));
    if (map.getBounds().contains(report.location!)) {
      // console.log(`Report Locations: ${JSON.stringify(reportState.reportLocations)}`);
      if (!el) {
        reportState.setReportLocations(oldReports => {
          const newReps = [...oldReports];
          newReps.push(report);
          return newReps;
        });
      }
    } else {
      if (el) {
        reportState.setReportLocations(oldReports => {

          const newReps = [...oldReports];
          newReps.splice(oldReports.indexOf(el), 1);
          return newReps;
        });
      }
    }
  };
  useMapEvents({
    drag() {
      updateLocationsFunc();
    },
    zoom() {
      updateLocationsFunc();
    },
  });

  return <Marker
    position={report.location!}
    eventHandlers={{
      dblclick: () => {
        reportState.setCurrentReport(report);
        // TODO Mark this report as selected within the list of reports
        onClick();
      }
    }}
    keyboard={true}
    alt={`report-${index}`}
  >
    <Popup>
      {`Type: ${report.type}`}
    </Popup>
  </Marker>;
}

type LocationFinderProps = {
  setCurrentLoc: React.Dispatch<React.SetStateAction<L.LatLng>>;
}

const LocationFinder = ({ setCurrentLoc }: LocationFinderProps) => {
  const map = useMap();
  useMapEvents({
    click(e) {
      setCurrentLoc(e.latlng);
    },
    drag(_) {
      setCurrentLoc(map.getCenter());
    }
  });
  return null;
};

function MapPresenter({ reportState }: MapPresenterProps) {
  const loc = reportState.currentReport?.location ?? new L.LatLng(49.2767096, -122.91780296438841);
  const [isShowPopup, setIsShowPopup] = useState(false);
  const [currentLoc, setCurrentLoc] = useState(loc);
  return (
    <>
      <MapContainer style={{ width: '100%', height: '100%', borderRadius: '10px' }} center={loc} zoom={13}>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" crossOrigin={true}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' />
        <MapContainerRecenterer reportState={reportState} />
        <LocationFinder setCurrentLoc={setCurrentLoc} />
        {reportState.reports.map((r, index) =>
          <MapMarker key={index} onClick={() => setIsShowPopup(true)}
            reportState={reportState} report={r} index={index} />
        )}
      </MapContainer>
      {isShowPopup &&
        <PopupPane>
          <ViewReport report={reportState.currentReport!} reportState={reportState} closeFunc={() => setIsShowPopup(false)} />
        </PopupPane>
      }
    </>
  )
}

interface MapSectionProps extends ReportDataProps {

}

function MapSection({ reportState }: MapSectionProps) {
  return (
    <div className="container" style={{ margin: '6% 6% 6% 0', width: '100%' }}>
      <h3 style={{ paddingBottom: '0.75em', fontWeight: 'bolder', width: '100%', fontSize: '50px', padding: '0.5em' }}>Map</h3>
      <MapPresenter reportState={reportState} />
    </div>
  );
}

type ViewReportProps = {
  closeFunc: () => void;
  report: ReportData;
  reportState: ReportsState;
}

function ViewReport({ closeFunc, report, reportState }: ViewReportProps) {
  useEffect(() => {
    if (report.location == null) {
      let locationElement = document.getElementById('view-report-location');
      locationElement!.innerText = '-';
    } else {
      latLngToString(report.location!)
        .then((str) => {
          let locationElement = document.getElementById('view-report-location');
          locationElement!.innerText = str;
        })
        .catch(() => {
          let locationElement = document.getElementById('view-report-location');
          console.log(`lng and lat: ${report.location!.lat}, ${report.location!.lng}`)
          locationElement!.innerText = `${report.location!.lat}, ${report.location!.lng}`;
        });
    }

    if (report.image == null) {
      let viewForm = document.getElementById('view-report-form');
      viewForm!.style.marginTop = '10em';
      let viewImg = document.getElementById('view-report-img');
      viewImg!.style.display = 'none';
    }

    if (report.status == ReportStatus.OPEN) {
      let viewStatus = document.getElementById('view-report-status-text');
      viewStatus!.classList.remove('red-colored');
      viewStatus!.classList.add('green-colored');
    } else {
      let viewStatus = document.getElementById('view-report-status-text');
      viewStatus!.classList.remove('green-colored');
      viewStatus!.classList.add('red-colored');
    }
  });
  return (
    <div className='report-container dark-bg' style={{ minWidth: '30%' }}>
      <h3 style={{ fontSize: '40px' }}>Report</h3>
      <img id='view-report-img' src={report.image} alt='Report Image'
        onLoad={
          (e) => {
            let viewForm = document.getElementById('view-report-form');
            viewForm!.style.marginTop = '0';
            let target: HTMLElement = e.currentTarget as HTMLElement;
            target.style.display = 'flex'
          }
        }
        onError={
          (e) => {
            let viewForm = document.getElementById('view-report-form');
            viewForm!.style.marginTop = '10em';
            let target: HTMLElement = e.currentTarget as HTMLElement;
            target.style.display = 'none'
          }
        } />
      <form id="view-report-form" onSubmit={closeFunc} style={{ marginTop: '10em' }}>
        <table id="view-report-middle">
          <tbody>
            <tr>
              <td className="view-report-title">Type: </td>
              <td id='view-report-type'>{report.type}</td>
            </tr>
            <tr>
              <td className="view-report-title">Location: </td>
              <td id='view-report-location'>{`${report.location!.lat}, ${report.location?.lng}`}</td>
            </tr>
            <tr>
              <td className="view-report-title">Reporter: </td>
              <td id='view-report-reporter'>{report.reporterName} ({report.reporterPhone})</td>
            </tr>
            <tr>
              <td className="view-report-title">Time: </td>
              <td id='view-report-time'>{`${new Date(report.time).toLocaleDateString()} (${getHMS(new Date(report.time))})`}</td>
            </tr>
            <tr>
              <td className="view-report-title">Status: </td>
              <td id='view-report-status'> <span id='view-report-status-text'>{report.status}</span> <input type="button" id='report-status-change' onClick={() => {
                let enteredPwd = prompt('Enter the password:');
                if (enteredPwd == null) {
                  return;
                }

                if (isCorrectPassword(enteredPwd)) {
                  let statusElement = document.getElementById('view-report-status-text')!;

                  if (report.status == ReportStatus.OPEN) {
                    report.status = ReportStatus.RESOLVED;
                    statusElement.textContent = 'Resolved';
                    statusElement!.classList.remove('green-colored');
                    statusElement!.classList.add('red-colored');
                  } else {
                    report.status = ReportStatus.OPEN
                    statusElement.textContent = 'Open';
                    statusElement!.classList.remove('red-colored');
                    statusElement!.classList.add('green-colored');
                  }

                  localStorage.setItem('reports', JSON.stringify(reportState.reports));
                } else {
                  alert('Incorrect password!');
                }

              }} value='Change' /></td>
            </tr>
            <tr>
              <td className="view-report-title">Comments: </td>
              <td id='view-report-comments'>{report.comment}</td>
            </tr>
          </tbody>
        </table>

        <input id='view-report-close-button' type='submit' value="Close" formEncType='dialog' />
      </form>
    </div>
  )
}

type AddReportProps = {
  closeFunc: (report: ReportData) => void;
}

function AddReport({ closeFunc }: AddReportProps) {
  return (
    <div className='report-container dark-bg' style={{ minWidth: '30%', width: 'fit-content', display: 'flex', flexDirection: 'column' }}>
      <h3 id='add-report-' style={{ fontSize: '40px' }}>Add Report</h3>
      <form id="add-report-form" onSubmit={() => {
        let reportComment: string | null = (document.getElementById('report-comments') as HTMLInputElement).value.trim();
        if (reportComment.length == 0) {
          reportComment = null;
        }
        let reportData: ReportData = {
          reporterName: (document.getElementById('report-witness-name') as HTMLInputElement).value,
          reporterPhone: (document.getElementById('report-witness-phone') as HTMLInputElement).value,
          type: (document.getElementById('report-emergency-type') as HTMLInputElement).value,
          location: null,
          time: Date.now(),
          status: ReportStatus.OPEN,
          comment: reportComment ?? undefined,
          image: (document.getElementById('report-url') as HTMLInputElement).value
        };

        const locString = (document.getElementById('report-location') as HTMLInputElement).value.trim();
        const isRawLatLong = /^[-]?((\d*[.]\d+)|(\d+([.]\d*)?))\s*,\s*[-]?((\d*[.]\d+)|(\d+([.]\d*)?))$/.test(locString.trim());

        const errorElement = document.getElementById('report-loc-error')!;

        if (!isRawLatLong) {
          errorElement.innerText = `Searching for location '${locString}'...`;
          errorElement.style.display = 'block';
          stringToLatLng(locString)
            .then(response => {
              reportData.location = response;
              closeFunc(reportData);
            })
            .catch(_ => {
              errorElement.innerText = `Location '${locString}' is invalid!`;
              errorElement.style.display = 'block';
            });
        } else {
          const nums = locString.split(',').map(s => +s.trim());
          reportData.location = new L.LatLng(nums![0], nums![1]);
          closeFunc(reportData);
        }
      }}>
        <div>
          <label htmlFor='report-witness-name'>Witness Name</label>
          <input id='report-witness-name' type='text' name='witness-name' required />
        </div>

        <div>
          <label htmlFor='report-witness-phone'>Witness Phone Number</label>
          <input id='report-witness-phone'
            type="tel"
            pattern="((\+?\d{1,3}-)?\d{3}-\d{3}-\d{4})|(\d{10,13})|(\+\d{11,13})|((\+\d{1,3})?[ ]*\(\d{1,3}\)[ ]+\d{3}-\d{4})"
            name='witness-phone' required />
        </div>

        <div>
          <label htmlFor='report-emergency-type'>Report Type</label>
          <input id='report-emergency-type' type='text' name='emergency-type' required />
        </div>

        <div>
          <label htmlFor='report-location'>Location (Name or Lat, Long)</label>
          <input id='report-location' type='text' name='location' required />
        </div>

        <div>
          <label htmlFor='report-url'>Image URL (optional)</label>
          <input id='report-url' type='text' name='url' />
        </div>

        <div>
          <label htmlFor='report-comments'>Comments (optional)</label>
          <input id='report-comments' type='text' name='comments' />
        </div>

        <input id='submit-button' type='submit' formMethod='dialog' />

        <p id="report-loc-error" style={{ color: 'red', display: 'none' }}></p>
      </form>
    </div >
  )
}

interface ReportItemProps extends ReportDataProps {
  report: ReportData,
  id: number
}

function getHMS(date: Date): string {
  let hourNum = date.getHours();
  let minuteNum = date.getMinutes();
  let secondNum = date.getSeconds();

  return `${hourNum >= 10 ? hourNum : '0' + hourNum}:${minuteNum >= 10 ? minuteNum : '0' + minuteNum}:${secondNum >= 10 ? secondNum : '0' + secondNum}`;
}

function ReportItem({ report, id, reportState }: ReportItemProps) {
  const [isShowingReportInfo, setIsShowingReportInfo] = useState(false);
  const reportElementId = `report-list-${id}`;
  const date = new Date(report.time);
  const time = `${date.toLocaleDateString()} (${getHMS(date)})`;

  useEffect(() => {
    report.location && latLngToString(report.location!)
      .then((locString) => {
        const reportElement = document.getElementById(reportElementId + '-location');
        reportElement && (reportElement.innerText = `${locString}`);
      })
      .catch(() => {
        const reportElement = document.getElementById(reportElementId + '-location');
        reportElement && (reportElement.innerText = `[${report.location?.lat}, ${report.location?.lng}]`);
      });

    if (report.status == ReportStatus.OPEN) {
      let reportStatus = document.getElementById(reportElementId + '-status');
      reportStatus!.classList.remove('red-colored');
      reportStatus!.classList.add('green-colored');
    } else {
      let reportStatus = document.getElementById(reportElementId + '-status');
      reportStatus!.classList.remove('green-colored');
      reportStatus!.classList.add('red-colored');
    }
  });

  return (
    <>
      <tr key={reportElementId} id={reportElementId} className='report-item'
        onClick={() => {
          setIsShowingReportInfo(true);
          reportState.setCurrentReport(report);
        }}
      >
        <td id={reportElementId + '-location'}>
          {`[${report.location!.lat}, ${report.location!.lng}]`}
        </td>
        <td>{report.type}</td>
        <td>{time}</td>
        <td id={reportElementId + '-status'} style={{ fontWeight: 'bold' }}>{report.status}</td>
        <td style={{ width: '30px', height: '30px' }} onClick={() => {
          let enteredPwd = prompt('Enter the password:');
          if (enteredPwd == null) {
            return;
          }

          if (!isCorrectPassword(enteredPwd)) {
            alert('Incorrect password!');
            return;
          }

          reportState.setReports(reps => {
            const newReps = [...reps];
            newReps.splice(id, 1);
            localStorage.setItem('reports', JSON.stringify(newReps));
            return newReps;
          });
          reportState.setReportLocations(oldLocs => {
            const oldEl = oldLocs.find(v => isReportsEqual(v, report));
            const newLocs = [...oldLocs];
            if (oldEl) {
              newLocs.splice(newLocs.indexOf(oldEl), 1);
            }
            return newLocs;
          })
        }}>
          <img src={closeIconWhite} alt='X' style={{ zIndex: '10', width: '100%', height: '100%' }} className='report-remove-style' />
        </td>
      </tr>
      {isShowingReportInfo &&
        <PopupPane>
          <ViewReport report={report} reportState={reportState} closeFunc={() => {
            setIsShowingReportInfo(false);
            // reportState.setCurrentReport(null);
          }} />
        </PopupPane>
      }
    </>
  );
}

interface ReportListProps extends ReportDataProps {
}

function ReportList({ reportState }: ReportListProps) {
  const [hasAddReportPopup, setHasAddReportPopup] = useState(false);
  const reportElements = reportState.reportLocations.map((e, index) => <ReportItem reportState={reportState} key={index} report={e} id={index} />);

  const [sortUp, setSortUp] = useState(false);

  const sortTableBy = (sortType: string) => {
    const tableElem = document.getElementById('report-table') as HTMLTableElement;
    if (tableElem) {
      reportState.setReportLocations(prevLocs => {
        const newLocs = [...prevLocs];

        switch (sortType.trim().toLowerCase()) {
          case 'location':
            newLocs.sort((a, b) => {
              let retVal = 0;
              const valMult = sortUp ? 1 : -1;

              const aLocName = localStorage.getItem(`location=${a.location?.lat}, ${a.location?.lng}`);
              const bLocName = localStorage.getItem(`location=${b.location?.lat}, ${b.location?.lng}`);

              if (!aLocName || !bLocName) {
                const latComp = (2 * +(a.location!.lat < b.location!.lat ? 1 : 0) - 1);
                const lngComp = (2 * +(a.location!.lng < b.location!.lng ? 1 : 0) - 1);
                retVal = latComp == 0 ? latComp : lngComp;
              } else {
                const strComp = 2 * +(aLocName < bLocName ? 1 : 0) - 1;
                retVal = strComp;
              }

              return retVal * valMult;
            });

            setSortUp(prev => !prev);
            break;
          case 'type':
            sortUp ? newLocs.sort((a, b) => a.type < b.type ? -1 : (a.type == b.type ? 0 : 1)) :
              newLocs.sort((a, b) => a.type < b.type ? 1 : (a.type == b.type ? 0 : -1));
            setSortUp(prev => !prev);
            break;
          case 'time':
            sortUp ? newLocs.sort((a, b) => a.time < b.time ? -1 : (a.time == b.time ? 0 : 1)) :
              newLocs.sort((a, b) => a.time < b.time ? 1 : (a.time == b.time ? 0 : -1))
            setSortUp(prev => !prev);
            break;
          case 'status':
            sortUp ? newLocs.sort((a, b) => a.status < b.status ? -1 : (a.status == b.status ? 0 : 1)) :
              newLocs.sort((a, b) => a.status < b.status ? 1 : (a.status == b.status ? 0 : -1));
            setSortUp(prev => !prev);
            break;
          default:
            return prevLocs;
        }

        return newLocs;
      })
    }
  };

  return (
    <>
      <ul className='dark-container report-list' style={{ maxHeight: '600px', justifyContent: 'flex-start', width: '100%', height: '100%' }}>
        <li key={reportElements.length + 2} style={{ width: '100%' }}>
          <table id="report-table" className='sortable' style={{ display: 'table', width: '100%', borderCollapse: 'collapse', borderSpacing: '0' }}>
            <thead>
              <tr key={reportElements.length + 2} style={{ padding: '1em 0' }}>
                <th onClick={() => sortTableBy("location")} style={{ padding: '1em 0' }}>Location</th>
                <th onClick={() => sortTableBy("type")} style={{ padding: '1em 0' }}>Type</th>
                <th onClick={() => sortTableBy("time")} style={{ padding: '1em 0' }}>Time Reported</th>
                <th onClick={() => sortTableBy("status")} style={{ padding: '1em 0' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {reportElements}
            </tbody>
          </table>
        </li>
        <li id='add-report-item' key={reportElements.length + 1} className='report-item' onClick={() => setHasAddReportPopup(true)}>
          <div style={{ flex: '2' }}>Add Report</div>
          <img src={addIcon} alt='+' style={{ width: '30px', height: '30px', padding: '5px' }}></img>
        </li>
      </ul>

      {hasAddReportPopup && <PopupPane>
        <AddReport closeFunc={(report) => {
          setHasAddReportPopup(false);
          reportState.setReports((reports) => {
            const newReports = [...reports];
            newReports.push(report);
            localStorage.setItem('reports', JSON.stringify(newReports));
            return newReports;
          });
          reportState.setOneTimeReport(() => {
            return report;
          });
          reportState.setReportLocations(oldLocs => {
            const el = reportState.reportLocations.find(v => isReportsEqual(v, report));
            if (!el) {
              const newLocs = [...oldLocs];
              newLocs.push(report);
              return newLocs;
            }
            return oldLocs;
          });
        }} />
      </PopupPane>}
    </>
  );
}

interface LocationsSection extends ReportDataProps {
}

function LocationsSection({ reportState }: ReportDataProps) {
  return (
    <div className='container' style={{ width: '100%', height: '100%' }}>
      <h3 style={{ padding: '0.5em', fontWeight: 'bolder', fontSize: '50px' }}>Reports</h3>
      <ReportList reportState={reportState} />
    </div>
  );
}
function ContentSection() {
  let [reports, setReports] = useState<ReportData[] | null>(null);
  let [reportLocations, setReportLocations] = useState<ReportData[]>([]);
  let [oneTimeReport, setOneTimeReport] = useState<ReportData | null>(null);

  if (!reports) {
    const reportsJson = localStorage.getItem('reports');
    if (reportsJson) {
      const dbReports = JSON.parse(reportsJson) as ReportData[];
      reports = dbReports;
      setReports(dbReports);
      if (dbReports.length > 0) {
        setOneTimeReport(dbReports[0]);
        setReportLocations([dbReports[0]]);
      }
    } else {
      reports = [];
      setReports([]);
    }
  }

  const [currentReport, setCurrentReport] = useState<ReportData | null>(reports!.length > 0 ? reports![0] : null);

  const reportState: ReportsState = {
    reports: reports!,
    setReports: setReports as React.Dispatch<React.SetStateAction<ReportData[]>>,
    currentReport,
    setCurrentReport,
    reportLocations,
    setReportLocations,
    oneTimeReport,
    setOneTimeReport
  };

  return (
    <div className="accent-bg" style={{ flex: '1 0 auto', display: 'flex', width: '100%', justifyContent: 'space-around' }}>
      <div style={{ display: 'flex', width: '85%' }}>
        <MapSection reportState={reportState} />
        <LocationsSection reportState={reportState} />
      </div>
    </div>
  );
}

function WebsiteTitle() {
  return <h1 style={{ padding: '0.5em', fontWeight: 'bolder', fontSize: '50px' }}>Emergency Reporter</h1>
}

function MainContent() {
  return (
    <div id="mainSection" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%' }}>
      <WebsiteTitle />
      <ContentSection />
    </div>
  );
}

function App() {
  return (
    <>
      <Nav />
      <MainContent />
    </>
  );
}


export default App
