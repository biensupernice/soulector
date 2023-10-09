import React from "react";
import { Soulector } from "../../components/Icons";

export function SoulectionLogo() {
  return (
    <div className="flex items-center space-x-2">
      <Soulector className="h-8 w-8 fill-current" />
      <SoulectionLogotype className="h-4 w-52 fill-current pr-10" />
    </div>
  );
}

export function SashaMarieRadioLogo() {
  return (
    <div className="flex items-center space-x-2">
      <SashaMarioRadio className="h-7 w-60 pt-1 fill-current pr-10" />
    </div>
  );
}

export function SoulectionLogotype(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 209 18"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M4.425 0H17.675C18.05 0 18.225 0.175001 18.225 0.55V2.925C18.225 3.3 18.05 3.475 17.675 3.475H5.15C4.2 3.475 3.825 4 3.825 4.875V5.725C3.825 6.65 4.25 7.125 5.125 7.125H14.5C17.375 7.125 18.875 8.675 18.875 11.425V13.425C18.875 15.85 17.475 17.5 14.45 17.5H0.6C0.225 17.5 0.0250001 17.325 0.0250001 16.95V14.575C0.0250001 14.2 0.225 14.025 0.6 14.025H13.725C14.675 14.025 15.05 13.5 15.05 12.625V11.6C15.05 10.675 14.625 10.2 13.75 10.2H4.375C1.5 10.2 0 8.65 0 5.9V4.075C0 1.65 1.4 0 4.425 0Z"
        // fill="black"
      />
      <path
        d="M28.5355 0H36.2605C41.3355 0 43.2605 1.8 43.2605 6.6V10.9C43.2605 15.7 41.3355 17.5 36.2605 17.5H28.5355C23.4855 17.5 21.5355 15.7 21.5355 10.9V6.6C21.5355 1.8 23.4855 0 28.5355 0ZM25.3605 6.875V10.625C25.3605 13.25 26.1105 14.025 28.6855 14.025H36.1105C38.6855 14.025 39.4355 13.25 39.4355 10.625V6.875C39.4355 4.25 38.6855 3.475 36.1105 3.475H28.6855C26.1105 3.475 25.3605 4.25 25.3605 6.875Z"
        // fill="black"
      />
      <path
        d="M46.8943 0H49.5943C49.9693 0 50.1443 0.175001 50.1443 0.55V10.525C50.1443 13.175 50.8943 13.95 53.4693 13.95H60.3943C62.9693 13.95 63.6943 13.175 63.6943 10.525V0.55C63.6943 0.175001 63.8693 0 64.2443 0H66.9693C67.3443 0 67.5193 0.175001 67.5193 0.55V10.9C67.5193 15.7 65.5943 17.5 60.5193 17.5H53.3193C48.2693 17.5 46.3193 15.7 46.3193 10.9V0.55C46.3193 0.175001 46.5193 0 46.8943 0Z"
        // fill="black"
      />
      <path
        d="M71.3084 0H74.0084C74.3834 0 74.5584 0.175001 74.5584 0.55V10.525C74.5584 13.175 75.3084 13.95 77.8834 13.95H88.0084C88.3834 13.95 88.5584 14.125 88.5584 14.5V16.95C88.5584 17.325 88.3834 17.5 88.0084 17.5H77.7334C72.6834 17.5 70.7334 15.7 70.7334 10.9V0.55C70.7334 0.175001 70.9334 0 71.3084 0Z"
        // fill="black"
      />
      <path
        d="M97.6029 0H108.603C108.978 0 109.178 0.175001 109.178 0.55V2.925C109.178 3.3 108.978 3.475 108.603 3.475H97.6779C95.0779 3.475 94.3529 4.25 94.3529 6.875V7.125H108.478C108.853 7.125 109.028 7.3 109.028 7.675V9.65C109.028 10.025 108.853 10.2 108.478 10.2H94.3529V10.625C94.3529 13.25 95.0779 14.025 97.6779 14.025H108.603C108.978 14.025 109.178 14.2 109.178 14.575V16.95C109.178 17.325 108.978 17.5 108.603 17.5H97.6029C92.5529 17.5 90.6029 15.7 90.6029 10.9V6.6C90.6029 1.8 92.5529 0 97.6029 0Z"
        // fill="black"
      />
      <path
        d="M118.843 0H130.118C130.493 0 130.668 0.175001 130.668 0.55V3C130.668 3.375 130.493 3.575 130.118 3.575H118.993C116.418 3.575 115.668 4.325 115.668 6.975V10.525C115.668 13.175 116.418 13.95 118.993 13.95H130.118C130.493 13.95 130.668 14.125 130.668 14.5V16.95C130.668 17.325 130.493 17.5 130.118 17.5H118.843C113.793 17.5 111.843 15.7 111.843 10.9V6.6C111.843 1.8 113.793 0 118.843 0Z"
        // fill="black"
      />
      <path
        d="M132.832 0H152.357C152.732 0 152.932 0.175001 152.932 0.55V3C152.932 3.375 152.732 3.575 152.357 3.575H144.507V16.95C144.507 17.325 144.332 17.5 143.957 17.5H141.232C140.857 17.5 140.682 17.325 140.682 16.95V3.575H132.832C132.457 3.575 132.257 3.375 132.257 3V0.55C132.257 0.175001 132.457 0 132.832 0Z"
        // fill="black"
      />
      <path
        d="M155.733 0H158.433C158.808 0 158.983 0.175001 158.983 0.55V16.95C158.983 17.325 158.808 17.5 158.433 17.5H155.733C155.358 17.5 155.158 17.325 155.158 16.95V0.55C155.158 0.175001 155.358 0 155.733 0Z"
        // fill="black"
      />
      <path
        d="M169.112 0H176.837C181.912 0 183.837 1.8 183.837 6.6V10.9C183.837 15.7 181.912 17.5 176.837 17.5H169.112C164.062 17.5 162.112 15.7 162.112 10.9V6.6C162.112 1.8 164.062 0 169.112 0ZM165.937 6.875V10.625C165.937 13.25 166.687 14.025 169.262 14.025H176.687C179.262 14.025 180.012 13.25 180.012 10.625V6.875C180.012 4.25 179.262 3.475 176.687 3.475H169.262C166.687 3.475 165.937 4.25 165.937 6.875Z"
        // fill="black"
      />
      <path
        d="M189.196 0H191.396C192.996 0 193.346 0.2 194.296 1.475L203.596 13.675C203.671 13.8 203.771 13.85 203.921 13.85H204.146C204.271 13.85 204.346 13.775 204.346 13.6V0.55C204.346 0.175001 204.521 0 204.896 0H207.521C207.896 0 208.071 0.175001 208.071 0.55V14.9C208.071 16.925 207.346 17.5 205.821 17.5H203.671C202.146 17.5 201.771 17.35 200.771 16.025L191.446 3.825C191.346 3.7 191.271 3.65 191.121 3.65H190.896C190.746 3.65 190.696 3.725 190.696 3.9V16.95C190.696 17.325 190.521 17.5 190.146 17.5H187.521C187.146 17.5 186.946 17.325 186.946 16.95V2.6C186.946 0.575 187.671 0 189.196 0Z"
        // fill="black"
      />
    </svg>
  );
}

export function SashaMarioRadio(props: any) {
  return (
    <svg
      {...props}
      viewBox="0 0 357 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M282.491 39.324C280.663 38.9391 279.364 38.2175 277.68 36.7262C276.381 35.5716 274.745 33.503 274.024 32.1559C273.254 30.8089 272.244 28.2591 271.763 26.4792C271.234 24.6992 270.656 21.6683 270.512 19.7921L270.223 16.3283L272.148 15.7992C273.206 15.5105 274.649 14.837 275.323 14.3078C276.044 13.7305 276.958 12.6721 277.343 11.9024C277.728 11.1327 278.065 9.64132 278.065 8.53485C278.065 7.47647 277.68 5.93701 277.295 5.11917C276.862 4.30132 275.804 3.38726 274.89 3.00241C273.976 2.61755 272.869 2.32888 272.34 2.32888C271.859 2.32888 271.089 2.71374 270.608 3.24294C269.983 3.91647 269.261 7.1397 268.058 14.3559L266.327 24.5548L267.433 25.3727C268.155 25.95 268.443 26.5273 268.251 27.0084C268.01 27.6818 267.193 27.8262 263.392 27.8262C259.591 27.8262 258.822 27.6818 258.822 27.0565C258.822 26.6716 259.351 26.0943 259.976 25.8056C260.65 25.517 261.371 24.6029 261.66 23.7851C261.901 22.9192 262.526 20.1289 263.055 17.4829C263.584 14.837 264.258 10.7478 264.595 8.43862C265.172 4.63809 265.124 4.15701 264.402 3.33917C263.921 2.80996 262.815 2.28079 261.901 2.13644C260.987 1.99212 259.11 2.23266 257.715 2.61755C256.32 3.0505 254.492 3.86834 253.674 4.49374C252.856 5.11917 251.702 6.5624 251.172 7.717C250.595 8.87158 250.162 10.6035 250.162 11.5656C250.162 12.7202 250.547 13.7786 251.365 14.7889C252.375 15.9435 253.001 16.2321 254.444 16.2802C255.502 16.2802 256.513 15.9435 256.897 15.5105C257.234 15.1256 257.523 14.2116 257.523 13.49C257.571 12.3354 257.811 12.191 259.062 12.191C260.265 12.191 260.505 12.3835 260.65 13.49C260.698 14.1635 260.554 15.2219 260.217 15.7992C259.928 16.3765 258.966 17.1462 258.052 17.4829C257.138 17.8678 255.454 18.1565 254.203 18.2046C253.001 18.2046 251.221 17.7716 250.21 17.2424C249.2 16.7132 247.997 15.7511 247.516 15.0294C247.035 14.3078 246.506 13.1051 246.265 12.3835C246.073 11.6619 246.121 10.0743 246.362 8.9197C246.65 7.62078 247.516 5.93701 248.43 4.8305C249.441 3.6759 251.221 2.4251 253.049 1.60726C255.262 0.596979 257.042 0.212122 259.928 0.0678044C262.093 -0.0765133 267 0.0197087 270.897 0.260248C277.151 0.645105 278.113 0.789423 279.652 1.8478C280.567 2.4732 281.625 3.53158 282.058 4.2051C282.443 4.87863 282.924 6.22564 283.068 7.1397C283.261 8.10186 283.164 9.78564 282.876 10.8921C282.539 12.1429 281.577 13.6824 280.422 14.837C279.22 16.0397 277.728 16.9538 276.333 17.3386C274.697 17.7716 274.216 18.1083 274.216 18.8781C274.216 19.4073 274.457 20.8505 274.697 22.0051C274.986 23.2078 276.044 25.9018 277.007 28.0186C278.017 30.1835 279.556 32.7332 280.422 33.7435C281.336 34.7537 282.924 36.0046 284.03 36.5819C285.089 37.111 286.917 37.5921 288.071 37.6403C289.803 37.6403 290.333 37.4478 291.295 36.2932C291.968 35.5716 292.497 34.7537 292.497 34.5132C292.497 34.2727 292.016 33.5991 291.487 33.07C290.525 32.1078 290.525 32.0116 291.343 31.0975C291.92 30.4721 292.69 30.2316 293.652 30.3278C294.614 30.3759 295.336 30.857 295.769 31.6748C296.394 32.7332 296.346 33.1181 295.624 34.6575C295.191 35.6197 293.941 36.9667 292.93 37.6884C289.149 40.1541 286.435 40.1691 282.491 39.324Z"
        // fill="black"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M1.92432 33.1181L0.481079 30.9533C0 29.7506 0 28.8846 0 28.7884C0 28.6441 0 27.3452 0.481079 25.9019L1.92432 23.4965L2.50162 22.9673C2.83838 22.7268 3.99298 21.9571 5.09946 21.2835C6.20593 20.61 8.13028 19.9365 9.4292 19.8403C11.113 19.6479 12.2195 19.7922 13.4221 20.4176C14.3843 20.8987 15.3946 21.8127 15.6832 22.4381C16.0681 23.3041 16.1162 23.9295 15.7314 24.6992C15.4908 25.3246 14.9616 25.95 14.5768 26.0944C14.24 26.2387 13.6146 26.1905 13.1816 26.0462C12.7005 25.8538 12.5562 25.4208 12.7487 24.8435C12.893 24.3144 12.7005 23.4003 12.2676 22.7268C11.6903 21.8608 11.0648 21.5241 9.91028 21.5241C9.09244 21.5722 7.88974 21.9089 7.31244 22.2938C6.68704 22.7268 5.9173 23.6889 5.48431 24.4587C5.09946 25.2284 4.81082 26.7678 4.81082 27.9224C4.81082 29.029 5.14755 30.7127 5.62866 31.6268C6.10974 32.5408 7.16812 33.7917 8.08215 34.369C8.94812 34.9944 10.68 35.6197 11.8827 35.7641C13.2297 36.0046 15.0097 35.9084 16.3087 35.5235C17.5114 35.2349 19.1951 34.417 20.1092 33.7435C20.9751 33.07 22.1297 31.8192 22.6108 31.0014C23.14 30.1835 23.6692 28.7884 23.8616 27.9224C24.054 26.9122 23.8616 25.5171 23.3324 24.17C22.8033 22.823 20.9751 20.4657 18.2811 17.5792C15.9719 15.1257 13.7108 12.4316 13.2778 11.5657C12.8449 10.7479 12.5081 9.11218 12.5081 7.90948C12.5081 6.51434 12.8449 5.26354 13.5665 4.20516C14.1438 3.3392 15.6351 2.0884 16.7897 1.46301C18.7141 0.500818 19.4838 0.356501 23.0438 0.548944L27.133 0.741358L28.1913 4.10894C28.7686 5.98516 29.1054 7.66894 28.9611 7.81326C28.8167 7.95757 28.2876 8.10192 27.8065 8.10192C27.2773 8.0538 26.5557 7.33218 25.9784 6.17758C25.4492 5.16732 24.5351 3.96462 23.9097 3.53164C23.3324 3.14678 22.0335 2.76193 21.0233 2.76193C19.8687 2.76193 18.8584 3.14678 18.2811 3.77218C17.7038 4.30139 17.2708 5.35974 17.2708 6.17758C17.2708 6.99542 17.6557 8.34246 18.0887 9.1603C18.5216 9.97814 20.446 12.3354 22.4184 14.4041C24.4389 16.5208 26.5076 19.263 27.1811 20.7062C27.8065 22.1014 28.3357 23.7371 28.3357 24.3144C28.3357 24.8917 28.6724 25.4208 29.0092 25.4208C29.3459 25.4208 30.0195 24.9878 30.4524 24.5068C30.8854 24.0257 32.8578 20.2252 34.8784 15.9916C38.1497 9.2084 38.4865 8.29434 37.7649 7.81326C37.3319 7.4765 37.1395 6.89919 37.2838 6.46624C37.5243 5.84085 38.2941 5.6965 40.94 5.6965C43.2011 5.6965 44.3076 5.88894 44.4519 6.2738C44.5481 6.61056 45.0292 10.7479 45.4622 15.5106C46.28 23.8814 46.3762 24.2181 47.6751 25.4689C48.6854 26.383 48.8778 26.816 48.4449 27.2489C48.1081 27.5857 46.28 27.8262 43.8746 27.8262C40.7476 27.8262 39.9297 27.6338 39.9297 27.1046C39.8816 26.7198 40.3627 26.0944 40.8919 25.7095C41.7097 25.1803 41.8541 24.603 41.7578 22.9192L41.6135 20.8505L35.6 20.5619L34.5897 22.5825C33.5795 24.5068 33.5795 24.6511 34.3973 25.2284C34.8303 25.5651 35.4076 25.9019 35.6481 25.9981C35.9368 26.0944 35.9849 26.5273 35.7924 26.9603C35.5519 27.6819 34.8303 27.8262 31.7513 27.8262H28.0951L27.4216 29.5581C27.0849 30.5203 26.0746 32.0597 25.2086 33.07C24.3427 34.0322 22.3703 35.4754 20.8789 36.197C18.8103 37.2554 17.3189 37.6403 14.4805 37.7846C11.546 37.977 10.247 37.7846 8.13028 37.0149C6.68701 36.4376 4.81082 35.3311 3.89676 34.5614C3.03082 33.7435 2.21298 33.1181 2.11676 33.1181H1.92432ZM38.5827 14.0673L40.6513 9.93002L40.94 11.9987C41.1324 13.1533 41.2768 15.0295 41.3249 16.136L41.373 18.2046H36.5622L38.5827 14.0673Z"
        // fill="black"
      />
      <path
        d="M49.5514 21.3796C47.2903 24.2661 49.1665 27.1045 54.2179 28.3553C57.5855 29.2212 63.0698 27.2969 64.3206 24.8434C66.3893 20.6099 65.6195 19.1186 58.2109 12.8164C56.6714 11.5175 56.2866 9.68936 57.3449 8.63098C57.6336 8.34234 58.7401 8.10177 59.7984 8.05367C61.4341 8.05367 61.9633 8.39044 63.5509 10.0742C66.3412 13.105 67.4958 12.1429 66.1968 7.86123C65.6206 5.94055 65.5716 5.93691 62.9883 5.7456L62.9736 5.7445C56.912 5.40774 55.1801 5.7926 53.0633 8.1499C50.4655 11.0364 51.3795 14.0672 55.9979 17.7234C59.6541 20.6099 60.8087 22.3418 60.1352 24.1218C59.1249 26.7677 53.7368 26.7196 53.0633 24.0737C52.8709 23.4002 52.9671 22.4861 53.2557 22.005C54.5547 19.9845 51.139 19.4072 49.5514 21.3796Z"
        // fill="black"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M356.509 14.9387C356.509 17.9238 355.954 19.2292 354.99 21.572C354.653 22.3418 353.354 23.9293 352.103 25.0839C350.852 26.1904 348.976 27.3931 347.918 27.7299C346.859 28.0185 344.887 28.3072 343.54 28.3072C342.145 28.3072 340.317 27.9704 339.499 27.6337C338.633 27.2969 337.238 26.1904 336.42 25.2764C335.506 24.218 334.688 22.6304 334.399 21.1391C334.063 19.6477 334.015 17.9158 334.255 16.6169C334.496 15.5104 334.929 13.971 335.217 13.2494C335.506 12.5277 336.66 10.9401 337.767 9.73745C338.922 8.48666 340.702 7.04339 341.76 6.51422C343.107 5.7926 344.646 5.50393 346.859 5.50393C348.88 5.45584 350.516 5.74447 351.67 6.32177C352.584 6.75476 353.931 7.90936 354.653 8.82342C356.193 10.749 356.509 12.3518 356.509 14.9387ZM341.952 25.7575C339.884 24.5547 339.066 22.8229 339.066 19.6477C339.114 15.5104 340.269 12.2391 342.722 9.68936C344.406 7.95745 345.031 7.5726 346.523 7.5726C350.083 7.62069 351.67 9.59313 351.67 14.2115C351.67 19.5996 349.361 24.3142 346.042 25.7093C344.069 26.5272 343.299 26.5272 341.952 25.7575Z"
        // fill="black"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M66.5818 25.8056C65.4272 26.3348 65.1386 26.8159 65.6678 27.4894C65.764 27.6818 67.8327 27.6818 70.2381 27.5856C73.317 27.3932 74.6159 27.1526 74.8083 26.6235C74.9527 26.2386 74.664 25.8537 74.0386 25.6132C73.0764 25.3245 73.0284 25.084 73.317 22.3419C73.5094 20.7062 73.8943 19.2148 74.231 19.0224C75.097 18.4932 82.6019 18.5894 82.9867 19.1667C83.131 19.4073 83.0348 20.8505 82.6981 22.2937C82.2651 24.4586 81.9283 25.0359 80.7737 25.6613C80.004 26.0462 79.3786 26.7197 79.3786 27.1045C79.3786 28.1148 96.9381 28.1629 97.3229 27.1526C97.6116 26.3829 96.7938 25.4208 95.7835 25.4208C95.0138 25.4208 95.3505 23.4002 96.457 21.6683C97.0824 20.7543 97.6116 20.6099 100.017 20.6099C102.519 20.6099 102.855 20.7062 103.096 21.6683C103.529 23.304 103.481 25.4208 102.952 25.4208C102.23 25.4208 100.979 26.864 101.268 27.3451C101.412 27.5856 103.385 27.8262 105.598 27.8262C108.917 27.8262 109.735 27.6337 109.975 27.0083C110.168 26.5754 109.975 26.0462 109.494 25.8056C108.147 25.0359 107.811 23.8332 107.041 16.2321C106.712 13.1297 106.356 10.055 106.161 8.37353L106.161 8.37152L106.094 7.79006C106.066 7.54696 106.044 7.35922 106.031 7.2359L105.79 5.69644H102.471C99.7765 5.64834 99.1029 5.84075 98.8624 6.51428C98.67 6.94726 98.7662 7.42834 99.0548 7.52456C99.3435 7.62075 99.584 8.05374 99.584 8.53481C99.584 9.68942 92.7046 24.0256 91.7905 24.7954C90.7321 25.6613 88.3748 25.9981 87.557 25.4208C86.8835 24.9878 86.9797 24.0256 88.1343 17.1943C88.8559 12.9127 89.5775 9.20834 89.77 8.9678C89.9143 8.67913 90.5397 8.29428 91.1651 8.05374C91.8867 7.8132 92.3678 7.2359 92.3678 6.65859C92.3678 5.74456 92.031 5.69644 87.99 5.69644C84.5262 5.69644 83.6121 5.84075 83.3716 6.41805C83.1792 6.85104 83.5159 7.57266 84.0932 8.10183C85.1035 9.06402 85.1035 9.64129 84.1894 14.3559L83.9008 16.0397L79.1381 16.1359L74.4235 16.2802L74.7602 13.7786C75.1932 10.411 76.1554 8.24618 77.4062 7.86129C77.9354 7.66888 78.4164 7.13967 78.4164 6.6105C78.4164 5.74456 78.0316 5.69644 73.8943 5.69644C70.2862 5.69644 69.2759 5.84075 69.0835 6.41805C68.8911 6.80291 69.1797 7.38021 69.757 7.71697C70.9597 8.48672 70.9597 10.2186 69.7089 17.2424C68.5543 23.8813 68.0732 25.1321 66.5818 25.8056ZM102.002 10.5215C101.657 10.4573 101.056 11.7675 99.8246 14.4521L98.1408 18.2046H102.952L102.615 14.4521C102.427 11.893 102.331 10.5828 102.002 10.5215Z"
        // fill="black"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M132.778 27.0565C132.778 26.6236 133.5 25.9981 134.366 25.6133C136.435 24.7473 136.627 24.2663 138.599 13.1533C140.379 3.00247 140.379 3.00247 136.531 2.28085C134.029 1.79977 131.431 2.37707 128.593 4.01275C125.947 5.55221 123.83 9.59329 124.263 12.2392C124.648 14.7408 126.236 16.2803 128.449 16.2803C130.469 16.2803 131.143 15.6549 131.383 13.6344C131.528 12.4317 131.816 12.143 132.826 11.9987C134.606 11.8062 135.472 13.3457 134.558 15.1738C133.211 18.0603 128.112 19.0225 124.215 17.1463C121.184 15.703 120.174 13.8749 120.366 10.1706C120.559 6.56246 122.002 4.39761 125.706 2.32894C129.411 0.212183 132.057 -0.22077 139.995 0.260309L146.874 0.645166L147.499 3.53167C149.712 13.3938 150.675 17.1944 151.011 17.0019C151.204 16.8576 153.465 13.1052 156.063 8.583L160.777 0.356531H165.011C169.004 0.404627 169.196 0.452753 168.956 1.36679C168.859 1.89599 168.426 2.32894 168.09 2.32894C166.791 2.32894 165.973 4.59002 164.578 12.4317C162.605 23.4965 162.461 24.6992 163.327 25.4209C164.433 26.3349 167.224 25.5652 168.234 24.0738C168.715 23.3522 170.591 19.6479 172.419 15.8954C175.402 9.68951 175.691 8.91976 175.113 7.86138C174.151 6.12948 174.825 5.6484 178.433 5.6484L181.752 5.69653L182.041 7.71707C182.134 8.432 182.348 10.4123 182.604 12.7885L182.605 12.7921L182.606 12.8026L182.608 12.8223C182.747 14.1143 182.899 15.5219 183.051 16.9057C183.484 20.8025 183.917 24.3144 184.062 24.6992C184.446 25.6614 186.323 26.0463 187.525 25.4209C188.728 24.7954 189.161 23.3041 190.556 15.1257L191.566 8.91976L190.46 8.05383C189.738 7.52462 189.498 6.94732 189.69 6.41815C189.979 5.6484 190.701 5.60031 196.425 5.74462C203.449 5.93707 204.604 6.32192 206.432 9.2084C208.452 12.4317 206.48 17.7717 202.631 19.6479C200.948 20.4176 200.948 20.8025 202.679 23.3522C204.123 25.469 206.095 26.2868 207.731 25.3727C208.837 24.7473 209.126 24.0257 210.088 19.3592C210.665 16.4727 211.291 12.7684 211.435 11.1327C211.772 8.39059 211.724 8.19814 210.713 7.95761C209.992 7.76516 209.703 7.3803 209.799 6.803C209.944 6.03329 210.569 5.88894 214.418 5.79275C218.555 5.6484 218.892 5.69653 218.892 6.56246C218.892 7.09167 218.459 7.66894 217.882 7.86138C216.486 8.29437 216.198 9.11221 214.803 17.1944L213.504 24.603L214.562 25.4209C215.284 25.95 215.524 26.5273 215.332 27.0084C215.091 27.73 214.129 27.8263 207.202 27.6819L199.408 27.5857L197.58 23.9776C195.463 19.6479 195.367 18.6857 196.906 18.6857C198.398 18.6857 201.14 16.8095 201.91 15.27C202.92 13.2495 202.679 10.6035 201.332 9.25653C199.793 7.71707 197.003 7.62084 196.281 9.01599C195.992 9.54516 195.175 13.2976 194.501 17.2906L193.298 24.603L194.357 25.4209C195.03 25.95 195.319 26.5273 195.126 27.0084C194.886 27.6819 193.731 27.8263 186.178 27.8263C180.213 27.8263 177.471 27.6338 177.23 27.249C176.893 26.7198 177.904 25.6614 179.106 25.2765C179.443 25.1322 179.443 24.4106 179.155 22.9673L178.673 20.8506L175.931 20.7063C173.285 20.5619 173.141 20.61 172.227 22.1495C170.976 24.17 170.976 25.2284 172.227 25.6614C172.804 25.8538 173.141 26.2868 173.045 26.7679C172.949 27.4895 171.842 27.5857 163.904 27.6819C156.159 27.8263 154.908 27.73 154.908 27.1046C154.908 26.7198 155.485 26.0463 156.255 25.6614C157.025 25.2765 157.795 24.4587 157.939 23.8333C158.66 20.8025 161.162 6.51437 161.066 6.12948C160.97 5.88894 158.757 9.59329 156.111 14.356C148.991 27.1527 148.558 27.7781 148.077 26.6236C147.692 25.6614 143.891 9.59329 143.458 6.99545C143.314 6.27383 143.073 5.6484 142.929 5.6484C142.737 5.6484 141.871 9.93005 140.957 15.1257C139.417 24.2181 139.417 24.603 140.235 25.2284C140.716 25.6133 141.293 25.9019 141.486 25.9019C141.726 25.9019 141.919 26.3349 141.919 26.8641C141.919 27.73 141.582 27.8263 137.349 27.8263C133.5 27.8263 132.778 27.6819 132.778 27.0565ZM174.151 17.9641C174.151 17.3387 177.759 10.5073 178.096 10.5073C178.289 10.5073 178.481 11.4214 178.481 12.5279C178.481 13.6344 178.577 15.3663 178.722 16.3765L178.962 18.2046H176.557C175.21 18.2046 174.151 18.0603 174.151 17.9641Z"
        // fill="black"
      />
      <path
        d="M218.748 25.469C217.497 26.0944 216.919 26.8641 217.208 27.4414C217.352 27.6338 221.201 27.8263 225.868 27.8263H234.286L235.489 25.0841C236.163 23.5446 236.836 21.8127 236.981 21.2354C237.414 19.4554 236.066 19.8403 234.335 22.0052C232.266 24.5549 230.438 25.469 227.648 25.3246C225.002 25.1322 224.857 24.7954 225.338 20.7544L225.675 18.2046H227.551C229.283 18.2046 229.476 18.3009 229.476 19.4073C229.476 20.4657 229.62 20.61 230.775 20.5138C231.977 20.3695 232.122 20.129 232.41 17.6754C232.534 16.7153 232.678 15.7552 232.778 15.0903C232.833 14.7224 232.874 14.445 232.891 14.3079C233.18 13.1052 231.352 13.2495 230.149 14.5484C229.283 15.4625 228.562 15.7992 227.648 15.703C226.397 15.5587 226.349 15.4144 226.493 13.6344C226.589 12.576 226.926 10.9403 227.215 10.0263C227.696 8.53491 227.984 8.29437 229.524 8.15005C231.737 8.00573 233.854 9.01599 235.201 10.9403C236.74 13.1052 237.846 12.9127 237.414 10.6035C237.221 9.59329 236.788 8.10192 236.403 7.23599L235.778 5.69653H228.513C222.259 5.69653 221.201 5.79275 220.961 6.46627C220.768 6.94735 221.057 7.52462 221.778 8.10192L222.885 8.91976L221.826 15.2219C220.383 23.4484 219.998 24.7954 218.748 25.469Z"
        // fill="black"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M279.027 27.1526C279.027 26.8159 279.797 25.998 280.759 25.3726C282.25 24.4105 283.213 22.871 286.34 16.5207C289.755 9.64129 290.092 8.77535 289.515 7.76507C288.649 6.08129 289.467 5.60021 292.978 5.74453L296.057 5.93698L297.068 15.27C297.934 22.9672 298.27 24.6991 298.992 25.2283C301.59 27.1526 302.841 25.4689 304.284 17.9159C305.727 10.2667 305.775 8.48669 304.524 7.71697C303.947 7.33212 303.658 6.85104 303.851 6.36996C304.14 5.69644 305.054 5.60021 310.73 5.74453C317.033 5.88888 317.417 5.98507 319.39 7.28399C322.276 9.16021 323.431 11.9986 323.142 16.2321C322.805 21.3316 320.448 24.7953 316.07 26.8159C314.05 27.6818 312.895 27.7781 302.696 27.7781C293.267 27.7781 291.535 27.6818 291.535 27.1045C291.535 26.7197 291.968 26.0943 292.497 25.7094C293.315 25.1802 293.46 24.6029 293.363 22.9191L293.219 20.8505L290.188 20.7062C287.35 20.5619 287.206 20.6099 286.484 22.0051C285.474 23.9775 285.522 25.2764 286.724 25.6613C287.35 25.8537 287.59 26.2386 287.446 26.6235C287.061 27.5856 279.027 28.1148 279.027 27.1526ZM308.469 25.2283C307.7 24.5548 307.7 24.218 308.517 19.1667C309.624 12.3354 310.49 9.01589 311.308 8.48669C312.318 7.86129 314.483 8.00561 316.022 8.77535C320.256 10.9883 319.149 21.5721 314.338 24.4105C312.125 25.7094 309.528 26.0462 308.469 25.2283ZM288.649 18.0121C288.649 17.9159 289.178 16.5689 289.9 14.9813C290.195 14.306 290.509 13.5753 290.793 12.9148L290.795 12.9091C291.157 12.0662 291.47 11.3386 291.631 10.9883C292.112 9.78561 292.161 9.83373 292.497 11.71C292.738 12.7683 292.93 14.6446 292.93 15.8953L292.978 18.2046H290.814C289.611 18.2046 288.649 18.1083 288.649 18.0121Z"
        // fill="black"
      />
      <path
        d="M322.95 25.9019C322.613 25.9019 322.324 26.3349 322.324 26.8641C322.324 27.73 322.613 27.8263 326.654 27.8263C330.022 27.8263 331.032 27.6338 331.272 27.0565C331.417 26.6717 331.128 25.9982 330.503 25.5171L329.444 24.6511L330.455 18.6376C331.994 9.78573 332.331 8.53491 333.678 8.05383C334.351 7.81329 334.832 7.23599 334.832 6.65869C334.832 5.74462 334.496 5.69653 330.455 5.69653C326.943 5.69653 326.077 5.84085 325.836 6.41815C325.644 6.89923 325.932 7.47653 326.558 7.90951C327.857 8.82354 327.857 9.49706 326.365 17.5311C325.163 23.9776 324.393 25.9019 322.95 25.9019Z"
        // fill="black"
      />
    </svg>
  );
}
